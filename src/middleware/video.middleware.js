const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { FileUploadUtils, DirectoryUtils, ResponseUtils } = require("../utils");
const {
  UPLOAD_DESTINATIONS,
  ALLOWED_FILE_TYPES,
  UPLOAD_FIELD_CONFIGS,
} = require("../constants/constants");

class VideoMiddleware {
  constructor() {
    this.isInitialized = false;
  }

  async initialize() {
    if (!this.isInitialized) {
      await DirectoryUtils.initializeAppDirectories();
      this.isInitialized = true;
    }
  }

  async ensureDirectories() {
    await this.initialize();
  }

  getMulterConfig() {
    const maxFileSizeMB = FileUploadUtils.parseFileSizeFromEnv(
      process.env.MAX_FILE_SIZE,
      50
    );

    const config = FileUploadUtils.createMulterConfig({
      destinations: UPLOAD_DESTINATIONS,
      allowedTypes: ALLOWED_FILE_TYPES,
      maxFileSizeMB,
    });

    return config;
  }

  uploadFiles() {
    const multerConfig = this.getMulterConfig();
    const upload = multer(multerConfig);

    return upload.fields(UPLOAD_FIELD_CONFIGS);
  }

  validateVideoRequest(req, res, next) {
    try {
      if (!req.files?.images || !req.files?.voiceover) {
        return ResponseUtils.send(
          res,
          ResponseUtils.validationError("Missing required files")
        );
      }

      const images = req.files.images;
      const voiceover = req.files.voiceover[0];

      const maxImages = parseInt(process.env.MAX_IMAGE_COUNT, 10) || 10;
      if (images.length > maxImages) {
        return ResponseUtils.send(
          res,
          ResponseUtils.validationError(`Maximum ${maxImages} images allowed`)
        );
      }

      req.videoData = { images, voiceover, imageCount: images.length };
      next();
    } catch (error) {
      return ResponseUtils.send(
        res,
        ResponseUtils.error("Validation failed", 500)
      );
    }
  }

  handleUploadError(err, req, res, next) {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return ResponseUtils.send(
          res,
          ResponseUtils.validationError(
            "Uploaded file exceeds the maximum allowed size",
            "File too large"
          )
        );
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return ResponseUtils.send(
          res,
          ResponseUtils.validationError(
            "Too many files uploaded",
            "Too many files"
          )
        );
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return ResponseUtils.send(
          res,
          ResponseUtils.validationError(
            "Unexpected file field in upload",
            "Unexpected file field"
          )
        );
      }
    }

    if (err) {
      return ResponseUtils.send(
        res,
        ResponseUtils.validationError(err.message, "Upload failed")
      );
    }

    next();
  }
}

module.exports = VideoMiddleware;
