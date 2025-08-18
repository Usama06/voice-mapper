const path = require("path");
const fs = require("fs-extra");
const ffmpeg = require("fluent-ffmpeg");
const {
  VideoUtils,
  VideoEffectsUtils,
  ResponseUtils,
  DirectoryUtils,
} = require("../utils");

// Try to set FFmpeg path
try {
  const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log("FFmpeg path:", ffmpegPath);
} catch (error) {
  console.log("FFmpeg installer not found, trying system PATH");
}

// Try to set FFprobe path - use multiple fallback options
try {
  // Try to install and use @ffprobe-installer package if available
  const ffprobePath = require("@ffprobe-installer/ffprobe").path;
  ffmpeg.setFfprobePath(ffprobePath);
  console.log("FFprobe path (from installer):", ffprobePath);
} catch (error) {
  try {
    // Fallback: Try the standard FFmpeg installer package (might not have ffprobe)
    const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
    const ffprobePath = ffmpegPath.replace("ffmpeg.exe", "ffprobe.exe");
    ffmpeg.setFfprobePath(ffprobePath);
    console.log("FFprobe path (from FFmpeg, might not exist):", ffprobePath);
  } catch (innerError) {
    console.log("Using system FFprobe from PATH");
  }
}

class VideoController {
  // Generate video from images and voiceover
  async generateVideo(req, res) {
    try {
      const startTime = Date.now();

      // Get validated data from middleware
      const { images, voiceover } = req.videoData;

      console.log(
        `Processing ${images.length} images with voiceover: ${voiceover.filename}`
      );

      // Validate inputs using VideoUtils
      const imagePaths = images.map((img) => img.path);
      const validation = await VideoUtils.validateVideoInputs(
        imagePaths,
        voiceover.path
      );

      if (!validation.isValid) {
        return ResponseUtils.send(
          res,
          ResponseUtils.validationError(validation.errors)
        );
      }

      // Get audio duration using VideoUtils
      const audioDuration = await VideoUtils.estimateAudioDuration(
        voiceover.path,
        60
      );
      console.log(`Audio duration: ${audioDuration} seconds`);

      // Generate safe output filename using VideoUtils
      const outputFilename =
        VideoUtils.createSafeVideoFilename("generated_video");
      const outputPath = path.join("./output/videos", outputFilename);

      // Calculate duration per image
      const durationPerImage = audioDuration / images.length;

      // Create video using the working legacy method
      await this.createVideoWithImages(
        images,
        voiceover.path,
        outputPath,
        durationPerImage
      );

      const processingTime = Date.now() - startTime;

      // Save mapping information
      const mapping = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        images: images.map((img) => ({
          filename: img.filename,
          originalName: img.originalname,
          size: img.size,
        })),
        voiceover: {
          filename: voiceover.filename,
          originalName: voiceover.originalname,
          size: voiceover.size,
          duration: audioDuration,
        },
        output: {
          filename: outputFilename,
          path: outputPath,
        },
        processingTime: `${processingTime}ms`,
        settings: {
          durationPerImage: `${(audioDuration / images.length).toFixed(2)}s`,
          totalImages: images.length,
        },
      };

      // Save to mappings.json
      await this.saveMappingInfo(mapping);

      return ResponseUtils.send(
        res,
        ResponseUtils.success(
          {
            videoFile: outputFilename,
            downloadUrl: `/api/video/download/${outputFilename}`,
            previewUrl: `/api/video/preview/${outputFilename}`,
            processingTime: `${processingTime}ms`,
            mapping: mapping,
          },
          "Video generated successfully"
        )
      );
    } catch (error) {
      console.error("Video generation error:", error);
      return ResponseUtils.send(
        res,
        ResponseUtils.error("Video generation failed", 500, {
          originalError: error.message,
        })
      );
    }
  }

  // Create video with Ken Burns effect (legacy method - consider using VideoUtils)
  async createVideoWithImages(images, audioPath, outputPath, durationPerImage) {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();
      const totalDuration = durationPerImage * images.length;

      // Add images as inputs
      images.forEach((image) => {
        command.addInput(image.path);
      });

      // Add audio input
      command.addInput(audioPath);

      // Build filter complex for Ken Burns effect with proper time distribution
      let filterComplex = "";
      let inputLabels = [];

      images.forEach((image, index) => {
        // Scale and crop each image
        const scale = `[${index}:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setpts=PTS-STARTPTS[v${index}scaled];`;

        // Apply Ken Burns with proper timing - use the calculated durationPerImage
        // Duration in frames = durationPerImage * framerate (25fps)
        const durationInFrames = Math.ceil(durationPerImage * 25);
        const kenburns = `[v${index}scaled]zoompan=z='min(zoom+0.0015,1.5)':d=${durationInFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=25,setpts=PTS-STARTPTS[v${index}];`;

        filterComplex += scale + kenburns;
        inputLabels.push(`[v${index}]`);
      });

      // Concatenate all video segments with proper timing
      filterComplex += `${inputLabels.join("")}concat=n=${
        images.length
      }:v=1:a=0[outv]`;

      command
        .complexFilter(filterComplex)
        .outputOptions([
          "-map",
          "[outv]",
          "-map",
          `${images.length}:a`, // Map audio from last input
          "-c:v",
          "libx264",
          "-c:a",
          "aac",
          "-preset",
          "medium",
          "-crf",
          "23",
          "-r",
          "25",
          "-t",
          totalDuration.toString(), // Limit total video duration to match audio
        ])
        .output(outputPath)
        .on("start", (commandLine) => {
          console.log("FFmpeg command:", commandLine);
          console.log(
            `📊 Time distribution: ${
              images.length
            } images × ${durationPerImage.toFixed(
              2
            )}s each = ${totalDuration.toFixed(2)}s total`
          );
        })
        .on("progress", (progress) => {
          // Calculate percentage manually from timemark
          let percentage = 0;
          if (progress.timemark && totalDuration > 0) {
            // Parse timemark (format: "00:01:30.45" -> seconds)
            const timemarkSeconds = VideoUtils.parseTimemark(progress.timemark);
            percentage = Math.round((timemarkSeconds / totalDuration) * 100);
            percentage = Math.min(percentage, 100); // Cap at 100%
          }

          console.log(
            `Processing: ${percentage}% done (${
              progress.timemark || "calculating..."
            })`
          );
        })
        .on("end", () => {
          console.log("Video generation completed");
          resolve();
        })
        .on("error", (err) => {
          console.error("FFmpeg error:", err);
          reject(err);
        })
        .run();
    });
  }

  // Save mapping information
  async saveMappingInfo(mapping) {
    const mappingsFile = "./output/mappings.json";
    let mappings = [];

    try {
      if (await fs.pathExists(mappingsFile)) {
        const data = await fs.readFile(mappingsFile, "utf8");
        mappings = JSON.parse(data);
      }
    } catch (error) {
      // File doesn't exist, creating new mappings file
      console.log("Creating new mappings file:", error.message);
    }

    mappings.push(mapping);
    await fs.writeFile(mappingsFile, JSON.stringify(mappings, null, 2));
  }

  // Download generated video
  async downloadVideo(req, res) {
    try {
      const filename = req.params.filename;
      const videoPath = path.join("./output/videos", filename);

      const fileExists = await DirectoryUtils.fileExists(videoPath);
      if (fileExists) {
        res.download(videoPath);
      } else {
        return ResponseUtils.send(res, ResponseUtils.notFound("Video file"));
      }
    } catch (error) {
      return ResponseUtils.send(
        res,
        ResponseUtils.error("Download failed", 500, {
          originalError: error.message,
        })
      );
    }
  }

  // Get video preview (stream)
  async previewVideo(req, res) {
    try {
      const filename = req.params.filename;
      const videoPath = path.join("./output/videos", filename);

      const fileExists = await DirectoryUtils.fileExists(videoPath);
      if (fileExists) {
        const stat = await fs.stat(videoPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunksize = end - start + 1;
          const file = fs.createReadStream(videoPath, { start, end });
          const head = {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": chunksize,
            "Content-Type": "video/mp4",
          };
          res.writeHead(206, head);
          file.pipe(res);
        } else {
          const head = {
            "Content-Length": fileSize,
            "Content-Type": "video/mp4",
          };
          res.writeHead(200, head);
          fs.createReadStream(videoPath).pipe(res);
        }
      } else {
        return ResponseUtils.send(res, ResponseUtils.notFound("Video file"));
      }
    } catch (error) {
      return ResponseUtils.send(
        res,
        ResponseUtils.error("Preview failed", 500, {
          originalError: error.message,
        })
      );
    }
  }

  // Get all mappings
  async getMappings(req, res) {
    try {
      const mappingsFile = "./output/mappings.json";

      const fileExists = await DirectoryUtils.fileExists(mappingsFile);
      if (fileExists) {
        const data = await fs.readFile(mappingsFile, "utf8");
        const mappings = JSON.parse(data);
        return ResponseUtils.send(
          res,
          ResponseUtils.success({ mappings }, "Mappings retrieved successfully")
        );
      } else {
        return ResponseUtils.send(
          res,
          ResponseUtils.success({ mappings: [] }, "No mappings found")
        );
      }
    } catch (error) {
      return ResponseUtils.send(
        res,
        ResponseUtils.error("Failed to get mappings", 500, {
          originalError: error.message,
        })
      );
    }
  }

  // Generate video with custom effects
  async generateVideoWithEffects(req, res) {
    try {
      const startTime = Date.now();

      // Get validated data from middleware
      const { images, voiceover } = req.videoData;
      const effects = req.body.effects || {};

      console.log(`Processing ${images.length} images with effects:`, effects);

      // Validate effects
      const effectsValidation = VideoEffectsUtils.validateEffects(effects);
      if (!effectsValidation.isValid) {
        return ResponseUtils.send(
          res,
          ResponseUtils.validationError(effectsValidation.errors)
        );
      }

      // Apply preset if specified
      let finalEffects = effects;
      if (effects.preset) {
        finalEffects = VideoEffectsUtils.applyPreset(effects.preset);
        // Allow overrides of preset values
        finalEffects = { ...finalEffects, ...effects };
        delete finalEffects.preset; // Remove preset from final effects
      }

      // Validate inputs using VideoUtils
      const imagePaths = images.map((img) => img.path);
      const validation = await VideoUtils.validateVideoInputs(
        imagePaths,
        voiceover.path
      );

      if (!validation.isValid) {
        return ResponseUtils.send(
          res,
          ResponseUtils.validationError(validation.errors)
        );
      }

      // Get audio duration
      const audioDuration = await VideoUtils.estimateAudioDuration(
        voiceover.path,
        60
      );
      console.log(`Audio duration: ${audioDuration} seconds`);

      // Generate safe output filename
      const outputFilename = VideoUtils.createSafeVideoFilename(
        `effects_video_${finalEffects.preset || "custom"}`
      );
      const outputPath = path.join("./output/videos", outputFilename);

      // Create video with effects
      await this.createVideoWithEffectsInternal(
        imagePaths,
        voiceover.path,
        outputPath,
        audioDuration,
        finalEffects
      );

      const processingTime = Date.now() - startTime;

      // Save mapping information
      const mapping = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type: "effects_video",
        images: images.map((img) => ({
          filename: img.filename,
          originalName: img.originalname,
          size: img.size,
        })),
        voiceover: {
          filename: voiceover.filename,
          originalName: voiceover.originalname,
          size: voiceover.size,
          duration: audioDuration,
        },
        effects: finalEffects,
        output: {
          filename: outputFilename,
          path: outputPath,
        },
        processingTime: `${processingTime}ms`,
        settings: {
          durationPerImage: `${(audioDuration / images.length).toFixed(2)}s`,
          totalImages: images.length,
          effectsApplied: Object.keys(finalEffects).filter(
            (key) => finalEffects[key] !== null
          ),
        },
      };

      // Save to mappings.json
      await this.saveMappingInfo(mapping);

      return ResponseUtils.send(
        res,
        ResponseUtils.success(
          {
            videoFile: outputFilename,
            downloadUrl: `/api/video/download/${outputFilename}`,
            previewUrl: `/api/video/preview/${outputFilename}`,
            processingTime: `${processingTime}ms`,
            effectsApplied: finalEffects,
            mapping: mapping,
          },
          "Video with effects generated successfully"
        )
      );
    } catch (error) {
      console.error("Effects video generation error:", error);
      return ResponseUtils.send(
        res,
        ResponseUtils.error("Effects video generation failed", 500, {
          originalError: error.message,
        })
      );
    }
  }

  // Get available effects
  async getAvailableEffects(req, res) {
    try {
      const effects = VideoEffectsUtils.getAvailableEffects();
      const presets = VideoEffectsUtils.getEffectPresets();

      return ResponseUtils.send(
        res,
        ResponseUtils.success(
          {
            effects,
            presets,
            usage: {
              description: "Use effects individually or apply a preset",
              examples: {
                individual: {
                  transition: "fade",
                  motion: "kenburns",
                  color: "vintage",
                  overlay: "light_leaks",
                  transitionDuration: 0.8,
                },
                preset: {
                  preset: "cinematic",
                },
                mixed: {
                  preset: "modern",
                  color: "sepia",
                  transitionDuration: 1.2,
                },
              },
            },
          },
          "Available video effects retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Get effects error:", error);
      return ResponseUtils.send(
        res,
        ResponseUtils.error("Failed to get available effects", 500, {
          originalError: error.message,
        })
      );
    }
  }

  // Preview effect on sample images
  async previewEffect(req, res) {
    try {
      const { effectType, effectName } = req.params;
      const { preset } = req.query;

      let effectToPreview;

      if (preset) {
        effectToPreview = VideoEffectsUtils.applyPreset(preset);
      } else {
        effectToPreview = { [effectType]: effectName };
      }

      const description = preset
        ? VideoEffectsUtils.getEffectPresets()[preset]?.description
        : `${effectType}: ${effectName}`;

      return ResponseUtils.send(
        res,
        ResponseUtils.success(
          {
            effect: effectToPreview,
            description,
            message:
              "Use this effect configuration in your video generation request",
          },
          "Effect preview retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Effect preview error:", error);
      return ResponseUtils.send(
        res,
        ResponseUtils.error("Failed to preview effect", 500, {
          originalError: error.message,
        })
      );
    }
  }

  // Internal method to create video with effects using VideoEffectsUtils
  async createVideoWithEffectsInternal(
    imagePaths,
    audioPath,
    outputPath,
    audioDuration,
    effects
  ) {
    return new Promise((resolve, reject) => {
      try {
        const command = VideoEffectsUtils.createVideoWithEffects(
          imagePaths,
          audioPath,
          outputPath,
          audioDuration,
          effects
        );

        command
          .on("start", (commandLine) => {
            console.log("FFmpeg command:", commandLine);
          })
          .on("progress", (progress) => {
            console.log(`Processing: ${progress.percent}% done`);
          })
          .on("error", (err, stdout, stderr) => {
            console.error("FFmpeg error:", err);
            console.error("FFmpeg stderr:", stderr);
            reject(new Error(`Video generation failed: ${err.message}`));
          })
          .on("end", () => {
            console.log("Video processing completed successfully");
            resolve();
          })
          .run();
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = VideoController;
