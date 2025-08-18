const fs = require("fs-extra");
const path = require("path");

class DirectoryUtils {
  static async ensureDirectories(directories) {
    const ensurePromises = directories.map((dir) => fs.ensureDir(dir));
    await Promise.all(ensurePromises);
  }

  static getDefaultUploadDirs() {
    return {
      images: "./uploads/images",
      audio: "./uploads/audio",
      videos: "./uploads/videos",
      documents: "./uploads/documents",
      temp: "./temp",
      output: "./output",
      outputVideos: "./output/videos",
    };
  }

  static getUploadDirsFromEnv() {
    const defaults = DirectoryUtils.getDefaultUploadDirs();

    return {
      images: process.env.UPLOAD_IMAGES_DIR || defaults.images,
      audio: process.env.UPLOAD_AUDIO_DIR || defaults.audio,
      videos: process.env.UPLOAD_VIDEOS_DIR || defaults.videos,
      documents: process.env.UPLOAD_DOCUMENTS_DIR || defaults.documents,
      temp: process.env.TEMP_DIR || defaults.temp,
      output: process.env.OUTPUT_DIR || defaults.output,
      outputVideos: process.env.OUTPUT_VIDEOS_DIR || defaults.outputVideos,
    };
  }

  static async initializeAppDirectories() {
    const dirs = DirectoryUtils.getUploadDirsFromEnv();
    const dirPaths = Object.values(dirs);

    await DirectoryUtils.ensureDirectories(dirPaths);
    console.log("✅ All required directories initialized");
  }

  static async fileExists(filePath) {
    return await fs.pathExists(filePath);
  }

  static async getFileStats(filePath) {
    try {
      return await fs.stat(filePath);
    } catch (error) {
      console.debug(`Failed to get stats for ${filePath}:`, error.message);
      return null;
    }
  }

  static createSafePath(...pathSegments) {
    return path.normalize(path.join(...pathSegments));
  }

  static getFileExtension(filename) {
    return path.extname(filename).toLowerCase();
  }

  static hasAllowedExtension(filename, allowedExtensions) {
    const ext = DirectoryUtils.getFileExtension(filename);
    return allowedExtensions.includes(ext);
  }

  static async cleanupOldFiles(directory, maxAgeMs = 24 * 60 * 60 * 1000) {
    try {
      const files = await fs.readdir(directory);
      const now = Date.now();
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = await DirectoryUtils.getFileStats(filePath);

        if (stats && now - stats.mtime.getTime() > maxAgeMs) {
          await fs.remove(filePath);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      console.warn(`Failed to cleanup directory ${directory}:`, error.message);
      return 0;
    }
  }
}

module.exports = DirectoryUtils;
