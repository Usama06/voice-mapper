const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const DirectoryUtils = require("./directory.utils");

class VideoUtils {
  /**
   * Get video configuration from environment variables
   * @returns {Object} - Video processing configuration
   */
  static getVideoConfig() {
    return {
      width: parseInt(process.env.VIDEO_WIDTH || "1920", 10),
      height: parseInt(process.env.VIDEO_HEIGHT || "1080", 10),
      fps: parseInt(process.env.VIDEO_FPS || "30", 10),
      videoBitrate: process.env.VIDEO_BITRATE || "4000k",
      audioBitrate: process.env.AUDIO_BITRATE || "128k",
      audioCodec: process.env.AUDIO_CODEC || "aac",
      videoCodec: process.env.VIDEO_CODEC || "libx264",
      preset: process.env.FFMPEG_PRESET || "medium",
      crf: parseInt(process.env.VIDEO_CRF || "23", 10),
      kenBurnsZoom: parseFloat(process.env.KEN_BURNS_ZOOM || "1.2"),
      kenBurnsDuration: parseInt(process.env.KEN_BURNS_DURATION || "5", 10),
    };
  }

  /**
   * Create a safe output filename for videos
   * @param {string} baseName - Base name for the file
   * @param {string} extension - File extension (default: 'mp4')
   * @returns {string} - Safe filename with timestamp
   */
  static createSafeVideoFilename(baseName = "video", extension = "mp4") {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const safeName = baseName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    return `${safeName}_${timestamp}_${randomSuffix}.${extension}`;
  }

  /**
   * Estimate audio duration (fallback when ffprobe fails)
   * @param {string} audioPath - Path to audio file
   * @param {number} fallbackDuration - Fallback duration in seconds
   * @returns {Promise<number>} - Audio duration in seconds
   */
  static async estimateAudioDuration(audioPath, fallbackDuration = 60) {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(audioPath, (err, metadata) => {
        if (err || !metadata?.format?.duration) {
          console.warn(
            "⚠️ Could not determine audio duration, using fallback:",
            fallbackDuration
          );
          resolve(fallbackDuration);
        } else {
          resolve(metadata.format.duration);
        }
      });
    });
  }

  /**
   * Calculate Ken Burns effect parameters
   * @param {number} index - Image index in sequence
   * @param {number} totalImages - Total number of images
   * @param {Object} config - Video configuration
   * @returns {Object} - Ken Burns effect parameters
   */
  static calculateKenBurnsEffect(index, totalImages, config) {
    const { width, height, kenBurnsZoom, kenBurnsDuration } = config;
    const isZoomIn = index % 2 === 0;

    if (isZoomIn) {
      return {
        startScale: 1.0,
        endScale: kenBurnsZoom,
        startX: 0,
        startY: 0,
        endX: Math.round((width * (kenBurnsZoom - 1)) / 2),
        endY: Math.round((height * (kenBurnsZoom - 1)) / 2),
        duration: kenBurnsDuration,
      };
    } else {
      return {
        startScale: kenBurnsZoom,
        endScale: 1.0,
        startX: Math.round((width * (kenBurnsZoom - 1)) / 2),
        startY: Math.round((height * (kenBurnsZoom - 1)) / 2),
        endX: 0,
        endY: 0,
        duration: kenBurnsDuration,
      };
    }
  }

  /**
   * Generate video filter for single image with Ken Burns effect
   * @param {number} imageIndex - Index of the image
   * @param {number} totalImages - Total number of images
   * @param {number} imageDuration - Duration for each image in seconds
   * @param {Object} config - Video configuration
   * @returns {string} - FFmpeg filter string
   */
  static generateImageFilter(imageIndex, totalImages, imageDuration, config) {
    const { width, height } = config;
    const effect = VideoUtils.calculateKenBurnsEffect(
      imageIndex,
      totalImages,
      config
    );

    return (
      `[${imageIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
      `crop=${width}:${height},` +
      `zoompan=z='if(lte(zoom,1.0),${effect.startScale},` +
      `${effect.startScale}+((${effect.endScale}-${effect.startScale})*on/${
        imageDuration * 30
      }))':` +
      `x='if(lte(zoom,1.0),${effect.startX},` +
      `${effect.startX}+((${effect.endX}-${effect.startX})*on/${
        imageDuration * 30
      }))':` +
      `y='if(lte(zoom,1.0),${effect.startY},` +
      `${effect.startY}+((${effect.endY}-${effect.startY})*on/${
        imageDuration * 30
      }))':` +
      `d=${imageDuration * 30}:s=${width}x${height}[v${imageIndex}]`
    );
  }

  /**
   * Create FFmpeg command for video generation
   * @param {Array} imagePaths - Array of image file paths
   * @param {string} audioPath - Path to audio file
   * @param {string} outputPath - Path for output video
   * @param {number} audioDuration - Duration of audio in seconds
   * @returns {Object} - FFmpeg command instance
   */
  static createVideoCommand(imagePaths, audioPath, outputPath, audioDuration) {
    const config = VideoUtils.getVideoConfig();
    const imageDuration = audioDuration / imagePaths.length;

    // Create FFmpeg command
    const command = ffmpeg();

    // Add image inputs
    imagePaths.forEach((imagePath) => {
      command.input(imagePath).loop(imageDuration);
    });

    // Add audio input
    command.input(audioPath);

    // Generate video filters
    const videoFilters = imagePaths.map((_, index) =>
      VideoUtils.generateImageFilter(
        index,
        imagePaths.length,
        imageDuration,
        config
      )
    );

    // Concatenate video streams
    const concatInputs = imagePaths.map((_, index) => `[v${index}]`).join("");
    const concatFilter = `${concatInputs}concat=n=${imagePaths.length}:v=1:a=0[outv]`;
    videoFilters.push(concatFilter);

    // Apply video filters
    command.complexFilter(videoFilters, ["outv"]);

    // Map streams and set output options
    command
      .map("[outv]")
      .map(`${imagePaths.length}:a`)
      .videoCodec(config.videoCodec)
      .audioCodec(config.audioCodec)
      .videoBitrate(config.videoBitrate)
      .audioBitrate(config.audioBitrate)
      .fps(config.fps)
      .outputOptions([
        `-preset ${config.preset}`,
        `-crf ${config.crf}`,
        "-movflags +faststart",
        "-shortest",
      ])
      .output(outputPath);

    return command;
  }

  /**
   * Validate video processing requirements
   * @param {Array} imagePaths - Array of image file paths
   * @param {string} audioPath - Path to audio file
   * @returns {Promise<Object>} - Validation result
   */
  static async validateVideoInputs(imagePaths, audioPath) {
    const errors = [];

    // Check if images exist
    for (const imagePath of imagePaths) {
      const exists = await DirectoryUtils.fileExists(imagePath);
      if (!exists) {
        errors.push(`Image file not found: ${imagePath}`);
      }
    }

    // Check if audio exists
    const audioExists = await DirectoryUtils.fileExists(audioPath);
    if (!audioExists) {
      errors.push(`Audio file not found: ${audioPath}`);
    }

    // Check image count
    if (imagePaths.length === 0) {
      errors.push("At least one image is required");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get supported image formats
   * @returns {Array<string>} - Array of supported image extensions
   */
  static getSupportedImageFormats() {
    return [".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tiff", ".webp"];
  }

  /**
   * Get supported audio formats
   * @returns {Array<string>} - Array of supported audio extensions
   */
  static getSupportedAudioFormats() {
    return [".mp3", ".wav", ".aac", ".m4a", ".ogg", ".flac"];
  }

  /**
   * Create progress tracking callback for FFmpeg
   * @param {Function} onProgress - Progress callback function
   * @param {number} totalDuration - Total duration for progress calculation
   * @returns {Function} - FFmpeg progress callback
   */
  static createProgressCallback(onProgress, totalDuration) {
    return (progress) => {
      if (onProgress && typeof onProgress === "function") {
        const percentage =
          totalDuration > 0
            ? Math.round((progress.timemark / totalDuration) * 100)
            : 0;

        onProgress({
          percentage,
          timemark: progress.timemark,
          currentFps: progress.currentFps,
          targetSize: progress.targetSize,
          currentKbps: progress.currentKbps,
        });
      }
    };
  }
}

module.exports = VideoUtils;
