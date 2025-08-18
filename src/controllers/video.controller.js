const path = require("path");
const fs = require("fs-extra");
const ffmpeg = require("fluent-ffmpeg");

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
  // Try the standard FFmpeg installer package first
  const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
  const ffprobePath = ffmpegPath.replace("ffmpeg.exe", "ffprobe.exe");
  ffmpeg.setFfprobePath(ffprobePath);
  console.log("FFprobe path (from FFmpeg):", ffprobePath);
} catch (error) {
  console.log("Using system FFprobe from PATH");
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

      // Get audio duration first
      const audioDuration = await this.getAudioDuration(voiceover.path);
      console.log(`Audio duration: ${audioDuration} seconds`);

      // Calculate duration per image
      const durationPerImage = audioDuration / images.length;

      // Generate unique output filename
      const outputFilename = `video-${Date.now()}.mp4`;
      const outputPath = path.join("./output/videos", outputFilename);

      // Create video with Ken Burns effect
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
          durationPerImage: `${durationPerImage.toFixed(2)}s`,
          totalImages: images.length,
        },
      };

      // Save to mappings.json
      await this.saveMappingInfo(mapping);

      res.json({
        success: true,
        message: "Video generated successfully",
        data: {
          videoFile: outputFilename,
          downloadUrl: `/api/video/download/${outputFilename}`,
          previewUrl: `/api/video/preview/${outputFilename}`,
          processingTime: `${processingTime}ms`,
          mapping: mapping,
        },
      });
    } catch (error) {
      console.error("Video generation error:", error);
      res.status(500).json({
        error: "Video generation failed",
        message: error.message,
      });
    }
  }

  // Get audio duration - simplified approach for now
  async getAudioDuration(audioPath) {
    return new Promise((resolve, reject) => {
      try {
        // For now, let's use a default duration or read from file metadata if possible
        // You can also pass duration as a parameter in the request
        const stats = require("fs").statSync(audioPath);

        // Rough estimation: assume 128kbps MP3, calculate duration from file size
        // This is an approximation: duration ≈ (file_size_in_bytes * 8) / (bitrate * 1000)
        const fileSizeBytes = stats.size;
        const estimatedBitrate = 128000; // 128 kbps
        const estimatedDuration = (fileSizeBytes * 8) / estimatedBitrate;

        console.log(
          `Estimated audio duration: ${estimatedDuration.toFixed(2)} seconds`
        );

        // Use minimum of 5 seconds, maximum of 60 seconds for safety
        const duration = Math.max(5, Math.min(60, estimatedDuration));
        resolve(duration);
      } catch (error) {
        console.log("Could not estimate duration, using default 10 seconds");
        resolve(10); // Default fallback
      }
    });
  }

  // Create video with Ken Burns effect
  async createVideoWithImages(images, audioPath, outputPath, durationPerImage) {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();

      // Add images as inputs
      images.forEach((image) => {
        command.addInput(image.path);
      });

      // Add audio input
      command.addInput(audioPath);

      // Build filter complex for Ken Burns effect
      let filterComplex = "";
      let inputLabels = [];

      images.forEach((image, index) => {
        const scale = `[${index}:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setpts=PTS-STARTPTS[v${index}scaled];`;
        const kenburns = `[v${index}scaled]zoompan=z='min(zoom+0.0015,1.5)':d=${Math.ceil(
          durationPerImage * 25
        )}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080[v${index}];`;

        filterComplex += scale + kenburns;
        inputLabels.push(`[v${index}]`);
      });

      // Concatenate all video segments
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
        ])
        .output(outputPath)
        .on("start", (commandLine) => {
          console.log("FFmpeg command:", commandLine);
        })
        .on("progress", (progress) => {
          console.log(`Processing: ${progress.percent}% done`);
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
      console.log("Creating new mappings file");
    }

    mappings.push(mapping);
    await fs.writeFile(mappingsFile, JSON.stringify(mappings, null, 2));
  }

  // Download generated video
  async downloadVideo(req, res) {
    try {
      const filename = req.params.filename;
      const videoPath = path.join("./output/videos", filename);

      if (await fs.pathExists(videoPath)) {
        res.download(videoPath);
      } else {
        res.status(404).json({ error: "Video not found" });
      }
    } catch (error) {
      res
        .status(500)
        .json({ error: "Download failed", message: error.message });
    }
  }

  // Get video preview (stream)
  async previewVideo(req, res) {
    try {
      const filename = req.params.filename;
      const videoPath = path.join("./output/videos", filename);

      if (await fs.pathExists(videoPath)) {
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
        res.status(404).json({ error: "Video not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Preview failed", message: error.message });
    }
  }

  // Get all mappings
  async getMappings(req, res) {
    try {
      const mappingsFile = "./output/mappings.json";

      if (await fs.pathExists(mappingsFile)) {
        const data = await fs.readFile(mappingsFile, "utf8");
        const mappings = JSON.parse(data);
        res.json({ success: true, mappings });
      } else {
        res.json({ success: true, mappings: [] });
      }
    } catch (error) {
      res
        .status(500)
        .json({ error: "Failed to get mappings", message: error.message });
    }
  }
}

module.exports = VideoController;
