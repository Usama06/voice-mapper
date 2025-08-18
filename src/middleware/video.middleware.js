const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { FileUploadUtils, DirectoryUtils, ResponseUtils } = require("../utils");

class VideoMiddleware {
  constructor() {
    this.isInitialized = false;
  }

  // Initialize middleware (called once during app startup)
  async initialize() {
    if (!this.isInitialized) {
      await DirectoryUtils.initializeAppDirectories();
      this.isInitialized = true;
      console.log("✅ Video middleware initialized");
    }
  }

  // Legacy method for backward compatibility
  async ensureDirectories() {
    await this.initialize();
  }

  // Create multer configuration using FileUploadUtils
  getMulterConfig() {
    const destinations = {
      images: "./uploads/images",
      voiceover: "./uploads/audio",
    };

    const allowedTypes = {
      images: [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/bmp",
        "image/webp",
      ],
      voiceover: [
        "audio/mpeg",
        "audio/wav",
        "audio/mp3",
        "audio/aac",
        "audio/ogg",
      ],
    };

    console.log("🔧 Middleware multer config:");
    console.log("  - Destinations:", destinations);
    console.log("  - Allowed types:", allowedTypes);

    const maxFileSizeMB = FileUploadUtils.parseFileSizeFromEnv(
      process.env.MAX_FILE_SIZE,
      50
    );

    const config = FileUploadUtils.createMulterConfig({
      destinations,
      allowedTypes,
      maxFileSizeMB,
    });

    console.log("  - Final config created");
    return config;
  }

  // File upload middleware using FileUploadUtils
  uploadFiles() {
    console.log("📤 Setting up file upload middleware...");
    const multerConfig = this.getMulterConfig();
    const upload = multer(multerConfig);

    // Direct field configuration for multer (not using FileUploadUtils for this)
    const fieldsConfig = [
      {
        name: "images",
        maxCount: parseInt(process.env.MAX_IMAGE_COUNT, 10) || 10,
      },
      {
        name: "voiceover",
        maxCount: parseInt(process.env.MAX_AUDIO_COUNT, 10) || 1,
      },
    ];

    console.log("  - Fields config:", fieldsConfig);

    return upload.fields(fieldsConfig);
  }

  // Validation middleware for video generation
  validateVideoRequest(req, res, next) {
    try {
      // Validate uploads using optional chaining
      if (!req.files?.images || !req.files?.voiceover) {
        return ResponseUtils.send(
          res,
          ResponseUtils.validationError(
            "Please upload at least one image and one voiceover file",
            "Missing required files"
          )
        );
      }

      const images = req.files.images;
      const voiceover = req.files.voiceover[0];

      // Validate image count
      const maxImages = parseInt(process.env.MAX_IMAGE_COUNT, 10) || 10;
      if (images.length > maxImages) {
        return ResponseUtils.send(
          res,
          ResponseUtils.validationError(
            `Maximum ${maxImages} images allowed`,
            "Too many images"
          )
        );
      }

      // Validate file sizes using FileUploadUtils
      const maxSizeMB = FileUploadUtils.parseFileSizeFromEnv(
        process.env.MAX_FILE_SIZE,
        50
      );
      const maxSizeBytes = maxSizeMB * 1024 * 1024;

      for (const image of images) {
        if (image.size > maxSizeBytes) {
          return ResponseUtils.send(
            res,
            ResponseUtils.validationError(
              `Image ${image.originalname} exceeds maximum size limit of ${maxSizeMB}MB`,
              "Image file too large"
            )
          );
        }
      }

      if (voiceover.size > maxSizeBytes) {
        return ResponseUtils.send(
          res,
          ResponseUtils.validationError(
            `Audio file exceeds maximum size limit of ${maxSizeMB}MB`,
            "Audio file too large"
          )
        );
      }

      // Add validated data to request
      req.videoData = {
        images,
        voiceover,
        imageCount: images.length,
      };

      next();
    } catch (error) {
      return ResponseUtils.send(
        res,
        ResponseUtils.error("Validation failed", 500, {
          originalError: error.message,
        })
      );
    }
  }

  // Error handling middleware for multer
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
