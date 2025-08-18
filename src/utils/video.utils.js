const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const DirectoryUtils = require("./directory.utils");
const {
  SUPPORTED_IMAGE_FORMATS,
  SUPPORTED_AUDIO_FORMATS,
} = require("../constants/constants");

class VideoUtils {
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

  static createSafeVideoFilename(baseName = "video", extension = "mp4") {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const safeName = baseName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    return `${safeName}_${timestamp}_${randomSuffix}.${extension}`;
  }

  static async estimateAudioDuration(audioPath, fallbackDuration = 60) {
    console.log(`🔍 Attempting to get duration for: ${audioPath}`);

    // Check if file exists first
    const fileExists = await DirectoryUtils.fileExists(audioPath);
    if (!fileExists) {
      console.warn(`❌ Audio file does not exist: ${audioPath}`);
      console.warn(
        "⚠️ Could not determine audio duration, using fallback:",
        fallbackDuration
      );
      return fallbackDuration;
    }

    console.log(`✅ Audio file exists, using FFmpeg to extract duration...`);

    return new Promise((resolve) => {
      let duration = null;

      // Use FFmpeg to probe duration by attempting to process the audio
      // We'll extract duration from the FFmpeg output before it starts encoding
      ffmpeg(audioPath)
        .format("null") // Output to null format (no actual output file)
        .on("start", (commandLine) => {
          console.log("🔍 FFmpeg duration probe started...");
        })
        .on("stderr", (stderrLine) => {
          // Look for duration in FFmpeg stderr output
          // Format: "Duration: 00:03:08.14, start: 0.000000, bitrate: 128 kb/s"
          const durationMatch = stderrLine.match(
            /Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d{2})/
          );
          if (durationMatch && !duration) {
            const hours = parseInt(durationMatch[1], 10);
            const minutes = parseInt(durationMatch[2], 10);
            const seconds = parseFloat(durationMatch[3]);
            duration = hours * 3600 + minutes * 60 + seconds;
            console.log(`✅ Audio duration found: ${duration} seconds`);
          }
        })
        .on("error", (err) => {
          if (duration) {
            // We got duration before the error, use it
            resolve(duration);
          } else {
            console.warn("❌ FFmpeg error:", err.message);
            console.warn(
              "⚠️ Could not determine audio duration, using fallback:",
              fallbackDuration
            );
            resolve(fallbackDuration);
          }
        })
        .on("end", () => {
          if (duration) {
            resolve(duration);
          } else {
            console.warn(
              "⚠️ No duration found in FFmpeg output, using fallback:",
              fallbackDuration
            );
            resolve(fallbackDuration);
          }
        })
        .save("NUL"); // Save to null device on Windows (won't actually create a file)
    });
  }

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

  static createVideoCommand(imagePaths, audioPath, outputPath, audioDuration) {
    const config = VideoUtils.getVideoConfig();
    const imageDuration = audioDuration / imagePaths.length;

    const command = ffmpeg();

    imagePaths.forEach((imagePath) => {
      command.input(imagePath).loop(imageDuration);
    });

    command.input(audioPath);

    const videoFilters = imagePaths.map((_, index) =>
      VideoUtils.generateImageFilter(
        index,
        imagePaths.length,
        imageDuration,
        config
      )
    );

    const concatInputs = imagePaths.map((_, index) => `[v${index}]`).join("");
    const concatFilter = `${concatInputs}concat=n=${imagePaths.length}:v=1:a=0[outv]`;
    videoFilters.push(concatFilter);

    command.complexFilter(videoFilters, ["outv"]);

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

  static async validateVideoInputs(imagePaths, audioPath) {
    const errors = [];

    for (const imagePath of imagePaths) {
      const exists = await DirectoryUtils.fileExists(imagePath);
      if (!exists) {
        errors.push(`Image file not found: ${imagePath}`);
      }
    }

    const audioExists = await DirectoryUtils.fileExists(audioPath);
    if (!audioExists) {
      errors.push(`Audio file not found: ${audioPath}`);
    }

    if (imagePaths.length === 0) {
      errors.push("At least one image is required");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  static getSupportedImageFormats() {
    return SUPPORTED_IMAGE_FORMATS;
  }

  static getSupportedAudioFormats() {
    return SUPPORTED_AUDIO_FORMATS;
  }

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

  // Parse FFmpeg timemark (format: "00:01:30.45") to seconds
  static parseTimemark(timemark) {
    if (!timemark || typeof timemark !== "string") {
      return 0;
    }

    try {
      const parts = timemark.split(":");
      if (parts.length !== 3) {
        return 0;
      }

      const hours = parseFloat(parts[0]) || 0;
      const minutes = parseFloat(parts[1]) || 0;
      const seconds = parseFloat(parts[2]) || 0;

      return hours * 3600 + minutes * 60 + seconds;
    } catch (error) {
      console.warn(
        "Failed to parse timemark:",
        timemark,
        "Error:",
        error.message
      );
      return 0;
    }
  }
}

module.exports = VideoUtils;
