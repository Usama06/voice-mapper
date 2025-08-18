const multer = require("multer");
const path = require("path");

class FileUploadUtils {
  /**
   * Generate unique filename with timestamp and random suffix
   * @param {string} fieldname - The form field name
   * @param {string} originalname - Original filename
   * @returns {string} - Unique filename
   */
  static generateUniqueFilename(fieldname, originalname) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    return fieldname + "-" + uniqueSuffix + path.extname(originalname);
  }

  /**
   * Get file destination based on field name and configuration
   * @param {Object} destinationMap - Mapping of field names to directories
   * @param {string} fieldname - The form field name
   * @returns {string|null} - Destination path or null if not found
   */
  static getFileDestination(destinationMap, fieldname) {
    return destinationMap[fieldname] || null;
  }

  /**
   * Create multer storage configuration
   * @param {Object} destinationMap - Mapping of field names to directories
   * @returns {multer.StorageEngine} - Multer storage engine
   */
  static createStorageConfig(destinationMap) {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        const destination = FileUploadUtils.getFileDestination(
          destinationMap,
          file.fieldname
        );
        if (destination) {
          cb(null, destination);
        } else {
          cb(new Error(`Unexpected field: ${file.fieldname}`), null);
        }
      },
      filename: (req, file, cb) => {
        const filename = FileUploadUtils.generateUniqueFilename(
          file.fieldname,
          file.originalname
        );
        cb(null, filename);
      },
    });
  }

  /**
   * Create file size limits configuration
   * @param {number} maxFileSizeMB - Maximum file size in MB
   * @returns {Object} - Multer limits configuration
   */
  static createFileLimits(maxFileSizeMB = 50) {
    return {
      fileSize: maxFileSizeMB * 1024 * 1024, // Convert MB to bytes
    };
  }

  /**
   * Create file filter for validating file types
   * @param {Object} allowedTypes - Mapping of field names to allowed MIME type patterns
   * @returns {Function} - Multer file filter function
   */
  static createFileFilter(allowedTypes) {
    return (req, file, cb) => {
      console.log("🔍 File filter debug:");
      console.log("  - Field name:", file.fieldname);
      console.log("  - MIME type:", file.mimetype);
      console.log("  - Original name:", file.originalname);
      console.log("  - Allowed types:", JSON.stringify(allowedTypes, null, 2));

      const allowedPattern = allowedTypes[file.fieldname];
      console.log("  - Allowed pattern for field:", allowedPattern);

      if (!allowedPattern) {
        console.log("❌ No pattern found for field:", file.fieldname);
        return cb(new Error(`Unexpected field: ${file.fieldname}`), false);
      }

      // Check if mimetype matches the allowed pattern
      let isAllowed = false;

      if (Array.isArray(allowedPattern)) {
        // Handle array of MIME types
        isAllowed = allowedPattern.includes(file.mimetype);
        console.log("  - Array check result:", isAllowed);
      } else if (typeof allowedPattern === "string") {
        // Handle string pattern (startsWith check)
        isAllowed = file.mimetype.startsWith(allowedPattern);
        console.log("  - String check result:", isAllowed);
      } else if (allowedPattern instanceof RegExp) {
        // Handle regex pattern
        isAllowed = allowedPattern.test(file.mimetype);
        console.log("  - Regex check result:", isAllowed);
      }

      if (isAllowed) {
        console.log("✅ File accepted");
        cb(null, true);
      } else {
        console.log("❌ File rejected");
        const fieldDescription = FileUploadUtils.getFieldDescription(
          file.fieldname
        );
        cb(
          new Error(
            `Only ${fieldDescription} are allowed for ${file.fieldname} field`
          ),
          false
        );
      }
    };
  }

  /**
   * Get human-readable description for field types
   * @param {string} fieldname - The form field name
   * @returns {string} - Human-readable description
   */
  static getFieldDescription(fieldname) {
    const descriptions = {
      images: "image files (PNG, JPG, GIF, etc.)",
      voiceover: "audio files (MP3, WAV, M4A, etc.)",
      documents: "document files (PDF, DOC, TXT, etc.)",
      videos: "video files (MP4, AVI, MOV, etc.)",
    };
    return descriptions[fieldname] || "valid files";
  }

  /**
   * Create complete multer configuration
   * @param {Object} options - Configuration options
   * @param {Object} options.destinations - Field to directory mapping
   * @param {Object} options.allowedTypes - Field to MIME type mapping
   * @param {number} options.maxFileSizeMB - Maximum file size in MB
   * @returns {Object} - Complete multer configuration
   */
  static createMulterConfig(options) {
    const { destinations, allowedTypes, maxFileSizeMB = 50 } = options;

    return {
      storage: FileUploadUtils.createStorageConfig(destinations),
      limits: FileUploadUtils.createFileLimits(maxFileSizeMB),
      fileFilter: FileUploadUtils.createFileFilter(allowedTypes),
    };
  }

  /**
   * Create field configuration for multer
   * @param {Object} fieldConfig - Field configuration mapping
   * @returns {Array} - Array of field configurations
   */
  static createFieldsConfig(fieldConfig) {
    return Object.entries(fieldConfig).map(([name, maxCount]) => ({
      name,
      maxCount,
    }));
  }

  /**
   * Parse file size from environment variable
   * @param {string} envValue - Environment variable value (e.g., "50MB")
   * @param {number} defaultValue - Default value in MB
   * @returns {number} - File size in MB
   */
  static parseFileSizeFromEnv(envValue, defaultValue = 50) {
    if (!envValue) return defaultValue;

    const sizeRegex = /^(\d+)(MB|KB|GB)?$/i;
    const match = sizeRegex.exec(envValue);
    if (!match) return defaultValue;

    const [, size, unit] = match;
    const sizeNum = parseInt(size, 10);

    switch (unit?.toUpperCase()) {
      case "KB":
        return sizeNum / 1024;
      case "GB":
        return sizeNum * 1024;
      case "MB":
      default:
        return sizeNum;
    }
  }
}

module.exports = FileUploadUtils;
