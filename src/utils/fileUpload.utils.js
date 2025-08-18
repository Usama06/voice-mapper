const multer = require("multer");
const path = require("path");

class FileUploadUtils {
  static generateUniqueFilename(fieldname, originalname) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    return fieldname + "-" + uniqueSuffix + path.extname(originalname);
  }

  static getFileDestination(destinationMap, fieldname) {
    return destinationMap[fieldname] || null;
  }

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

  static createFileLimits(maxFileSizeMB = 50) {
    return {
      fileSize: maxFileSizeMB * 1024 * 1024,
    };
  }

  static createFileFilter(allowedTypes) {
    return (req, file, cb) => {
      const allowedPattern = allowedTypes[file.fieldname];

      if (!allowedPattern) {
        return cb(new Error(`Unexpected field: ${file.fieldname}`), false);
      }

      let isAllowed = false;

      if (Array.isArray(allowedPattern)) {
        isAllowed = allowedPattern.includes(file.mimetype);
      } else if (typeof allowedPattern === "string") {
        isAllowed = file.mimetype.startsWith(allowedPattern);
      } else if (allowedPattern instanceof RegExp) {
        isAllowed = allowedPattern.test(file.mimetype);
      }

      if (isAllowed) {
        cb(null, true);
      } else {
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

  static getFieldDescription(fieldname) {
    const descriptions = {
      images: "image files (PNG, JPG, GIF, etc.)",
      voiceover: "audio files (MP3, WAV, M4A, etc.)",
      documents: "document files (PDF, DOC, TXT, etc.)",
      videos: "video files (MP4, AVI, MOV, etc.)",
    };
    return descriptions[fieldname] || "valid files";
  }

  static createMulterConfig(options) {
    const { destinations, allowedTypes, maxFileSizeMB = 50 } = options;

    return {
      storage: FileUploadUtils.createStorageConfig(destinations),
      limits: FileUploadUtils.createFileLimits(maxFileSizeMB),
      fileFilter: FileUploadUtils.createFileFilter(allowedTypes),
    };
  }

  static createFieldsConfig(fieldConfig) {
    return Object.entries(fieldConfig).map(([name, maxCount]) => ({
      name,
      maxCount,
    }));
  }

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
