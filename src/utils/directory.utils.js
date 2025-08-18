const fs = require("fs-extra");
const path = require("path");

class DirectoryUtils {
  /**
   * Ensure multiple directories exist
   * @param {Array<string>} directories - Array of directory paths
   * @returns {Promise<void>}
   */
  static async ensureDirectories(directories) {
    const ensurePromises = directories.map((dir) => fs.ensureDir(dir));
    await Promise.all(ensurePromises);
  }

  /**
   * Get default upload directories configuration
   * @returns {Object} - Default directory structure
   */
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

  /**
   * Get upload directories from environment or use defaults
   * @returns {Object} - Directory configuration
   */
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

  /**
   * Initialize all required directories for the application
   * @returns {Promise<void>}
   */
  static async initializeAppDirectories() {
    const dirs = DirectoryUtils.getUploadDirsFromEnv();
    const dirPaths = Object.values(dirs);

    await DirectoryUtils.ensureDirectories(dirPaths);
    console.log("✅ All required directories initialized");
  }

  /**
   * Check if file exists
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>} - True if file exists
   */
  static async fileExists(filePath) {
    return await fs.pathExists(filePath);
  }

  /**
   * Get file stats safely
   * @param {string} filePath - Path to file
   * @returns {Promise<fs.Stats|null>} - File stats or null if not found
   */
  static async getFileStats(filePath) {
    try {
      return await fs.stat(filePath);
    } catch (error) {
      // File doesn't exist or permission denied
      console.debug(`Failed to get stats for ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Create safe file path by joining and normalizing
   * @param {...string} pathSegments - Path segments to join
   * @returns {string} - Normalized path
   */
  static createSafePath(...pathSegments) {
    return path.normalize(path.join(...pathSegments));
  }

  /**
   * Get file extension safely
   * @param {string} filename - Filename
   * @returns {string} - File extension (with dot)
   */
  static getFileExtension(filename) {
    return path.extname(filename).toLowerCase();
  }

  /**
   * Check if file has allowed extension
   * @param {string} filename - Filename to check
   * @param {Array<string>} allowedExtensions - Array of allowed extensions
   * @returns {boolean} - True if extension is allowed
   */
  static hasAllowedExtension(filename, allowedExtensions) {
    const ext = DirectoryUtils.getFileExtension(filename);
    return allowedExtensions.includes(ext);
  }

  /**
   * Clean up old files in a directory
   * @param {string} directory - Directory to clean
   * @param {number} maxAgeMs - Maximum age in milliseconds
   * @returns {Promise<number>} - Number of files deleted
   */
  static async cleanupOldFiles(directory, maxAgeMs = 24 * 60 * 60 * 1000) {
    // Default: 24 hours
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
