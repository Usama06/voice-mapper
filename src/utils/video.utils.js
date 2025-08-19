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

      ffmpeg(audioPath)
        .format("null")
        .on("start", (commandLine) => {
          console.log("🔍 FFmpeg duration probe started...");
        })
        .on("stderr", (stderrLine) => {
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
        .save("NUL");
    });
  }

  static createVideoCommand(imagePaths, audioPath, outputPath, audioDuration) {
    const config = VideoUtils.getVideoConfig();
    const imageDuration = audioDuration / imagePaths.length;

    const command = ffmpeg();

    imagePaths.forEach((imagePath) => {
      command.input(imagePath);
    });

    command.input(audioPath);

    const videoFilters = [];

    imagePaths.forEach((_, index) => {
      videoFilters.push(
        `[${index}:v]scale=${config.width}:${config.height}:force_original_aspect_ratio=increase,` +
          `crop=${config.width}:${config.height},` +
          `setpts=PTS-STARTPTS,` +
          `zoompan=z='min(zoom+0.001,1.3)':d=${Math.round(
            imageDuration * config.fps
          )}:` +
          `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${config.width}x${config.height}:fps=${config.fps}[v${index}]`
      );
    });

    // Use simple concatenation without any transitions
    if (imagePaths.length === 1) {
      videoFilters.push(`[v0]copy[outv]`);
    } else {
      // Simple concatenation - no transitions, just join videos end-to-end
      const inputLabels = imagePaths.map((_, index) => `[v${index}]`).join("");
      videoFilters.push(
        `${inputLabels}concat=n=${imagePaths.length}:v=1:a=0[outv]`
      );
    }

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
