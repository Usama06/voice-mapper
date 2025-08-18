const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const DirectoryUtils = require("./directory.utils");

class AudioUtils {
  /**
   * Concatenate multiple audio files into a single file.
   * Approach: normalize each input to WAV (pcm_s16le, 44.1kHz, stereo),
   * write a concat list, then use the concat demuxer to produce final output.
   */
  static async concatenateAudioFiles(audioPaths, outputPath) {
    if (!Array.isArray(audioPaths) || audioPaths.length === 0) {
      throw new Error("No audio files provided");
    }

    // Validate inputs
    for (const p of audioPaths) {
      const exists = await DirectoryUtils.fileExists(p);
      if (!exists) throw new Error(`Audio file not found: ${p}`);
    }

    // Single-file shortcut
    if (audioPaths.length === 1) {
      await fsp.copyFile(audioPaths[0], outputPath);
      const duration = await AudioUtils.getAudioDuration(outputPath).catch(
        () => 60
      );
      return { outputPath, totalDuration: duration, sourceFiles: 1 };
    }

    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "vm-audio-"));
    const wavFiles = [];

    try {
      // Convert sequentially to avoid concurrent ffmpeg overload
      for (let i = 0; i < audioPaths.length; i++) {
        const src = audioPaths[i];
        const st = await fsp.stat(src).catch(() => null);
        if (!st || st.size === 0)
          throw new Error(`Invalid or empty audio file: ${src}`);

        const out = path.join(tmpDir, `part_${i}.wav`);
        console.log(
          `🔁 Converting audio ${i + 1}/${audioPaths.length}: ${src} -> ${out}`
        );
        await new Promise((res, rej) => {
          const cmd = ffmpeg(src)
            .noVideo()
            .audioCodec("pcm_s16le")
            .format("wav")
            .audioChannels(2)
            .audioFrequency(44100)
            .on("stderr", (line) => {
              // small amount of stderr to help debug
              // avoid overly verbose logs in prod
              if (line && line.trim())
                console.log(`[ffmpeg convert ${i}] ${line}`);
            })
            .on("end", () => res())
            .on("error", (err) => rej(err))
            .save(out);
          // in case ffmpeg spawn fails synchronously
          if (!cmd) rej(new Error("Failed to start ffmpeg for conversion"));
        });
        wavFiles.push(out);
      }

      // Build concat list
      const listPath = path.join(tmpDir, "files.txt");
      const listContent = wavFiles
        .map((f) => `file '${f.replace(/\\/g, "/")}'`)
        .join("\n");
      await fsp.writeFile(listPath, listContent, "utf8");

      // Run concat demuxer
      await new Promise((res, rej) => {
        // Determine output format and codec based on file extension
        const ext = path.extname(outputPath).toLowerCase();
        let audioCodec, audioFormat;

        switch (ext) {
          case ".mp3":
            audioCodec = "libmp3lame";
            audioFormat = "mp3";
            break;
          case ".wav":
            audioCodec = "pcm_s16le";
            audioFormat = "wav";
            break;
          case ".aac":
            audioCodec = "aac";
            audioFormat = "adts";
            break;
          default:
            // Default to MP3 for unknown extensions
            audioCodec = "libmp3lame";
            audioFormat = "mp3";
            break;
        }

        const c = ffmpeg()
          .input(listPath)
          .inputOptions(["-f", "concat", "-safe", "0"])
          .audioCodec(audioCodec)
          .format(audioFormat)
          .audioBitrate("128k")
          .audioFrequency(44100)
          .audioChannels(2)
          .output(outputPath)
          .on("start", (cmd) => console.log("🎵 FFmpeg concat started:", cmd))
          .on("stderr", (line) => {
            if (line?.trim()) console.log(`[ffmpeg concat] ${line}`);
          })
          .on("progress", (p) => {
            if (p.percent)
              console.log(`🎵 Audio concat: ${Math.round(p.percent)}%`);
          })
          .on("end", () => res())
          .on("error", (err) => rej(err));

        // defensive: ensure command started
        if (!c) return rej(new Error("Failed to start ffmpeg for concat"));
        c.run();
      });

      const totalDuration = await AudioUtils.getAudioDuration(outputPath).catch(
        () => 60
      );
      return { outputPath, totalDuration, sourceFiles: audioPaths.length };
    } finally {
      try {
        await fsp.rm(tmpDir, { recursive: true, force: true });
      } catch (e) {
        /* ignore cleanup errors */
      }
    }
  }

  /**
   * Get duration using ffprobe (fluent-ffmpeg wrapper)
   */
  static getAudioDuration(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, info) => {
        if (err) return reject(err);
        try {
          const stream = info.streams?.find((s) => s.codec_type === "audio");
          const duration =
            parseFloat(stream?.duration ?? info.format?.duration ?? 0) || 0;
          resolve(duration);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  static async validateAudioFile(audioPath) {
    try {
      const exists = await DirectoryUtils.fileExists(audioPath);
      if (!exists) return false;
      const d = await AudioUtils.getAudioDuration(audioPath);
      return d > 0;
    } catch (e) {
      return false;
    }
  }

  static async getAudioInfo(audioPath) {
    try {
      const duration = await AudioUtils.getAudioDuration(audioPath);
      const stats = await fsp.stat(audioPath);
      return {
        path: audioPath,
        duration,
        sizeBytes: stats.size,
        sizeMB: Math.round((stats.size / (1024 * 1024)) * 100) / 100,
        isValid: true,
      };
    } catch (err) {
      return {
        path: audioPath,
        duration: 0,
        sizeBytes: 0,
        sizeMB: 0,
        isValid: false,
        error: err.message,
      };
    }
  }

  static createSafeAudioFilename(
    prefix = "concatenated_voiceover",
    suffix = ""
  ) {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const safeSuffix = suffix ? `_${suffix}` : "";
    return `${prefix}_${timestamp}_${randomString}${safeSuffix}.mp3`;
  }
}

module.exports = AudioUtils;
