const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");

class VideoMiddleware {
  constructor() {
    // Ensure upload directories exist
    this.ensureDirectories();
  }

  async ensureDirectories() {
    const dirs = [
      "./uploads/images",
      "./uploads/audio",
      "./output/videos",
      "./temp",
    ];

    for (const dir of dirs) {
      await fs.ensureDir(dir);
    }
  }

  // File upload middleware configuration
  uploadFiles() {
    const upload = multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          if (file.fieldname === "images") {
            cb(null, "./uploads/images");
          } else if (file.fieldname === "voiceover") {
            cb(null, "./uploads/audio");
          }
        },
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(
            null,
            file.fieldname +
              "-" +
              uniqueSuffix +
              path.extname(file.originalname)
          );
        },
      }),
      limits: {
        fileSize:
          parseInt(process.env.MAX_FILE_SIZE?.replace("MB", "")) *
            1024 *
            1024 || 50 * 1024 * 1024, // 50MB default
      },
      fileFilter: (req, file, cb) => {
        if (file.fieldname === "images") {
          // Accept images
          if (file.mimetype.startsWith("image/")) {
            cb(null, true);
          } else {
            cb(
              new Error("Only image files are allowed for images field"),
              false
            );
          }
        } else if (file.fieldname === "voiceover") {
          // Accept audio files
          if (file.mimetype.startsWith("audio/")) {
            cb(null, true);
          } else {
            cb(
              new Error("Only audio files are allowed for voiceover field"),
              false
            );
          }
        } else {
          cb(new Error("Unexpected field"), false);
        }
      },
    });

    return upload.fields([
      { name: "images", maxCount: parseInt(process.env.MAX_IMAGE_COUNT) || 10 },
      {
        name: "voiceover",
        maxCount: parseInt(process.env.MAX_AUDIO_COUNT) || 1,
      },
    ]);
  }

  // Validation middleware for video generation
  validateVideoRequest(req, res, next) {
    try {
      // Validate uploads
      if (!req.files || !req.files.images || !req.files.voiceover) {
        return res.status(400).json({
          error: "Missing required files",
          message: "Please upload at least one image and one voiceover file",
        });
      }

      const images = req.files.images;
      const voiceover = req.files.voiceover[0];

      // Validate image count
      const maxImages = parseInt(process.env.MAX_IMAGE_COUNT) || 10;
      if (images.length > maxImages) {
        return res.status(400).json({
          error: "Too many images",
          message: `Maximum ${maxImages} images allowed`,
        });
      }

      // Validate file sizes
      const maxSize =
        parseInt(process.env.MAX_FILE_SIZE?.replace("MB", "")) * 1024 * 1024 ||
        50 * 1024 * 1024;

      for (const image of images) {
        if (image.size > maxSize) {
          return res.status(400).json({
            error: "Image file too large",
            message: `Image ${image.originalname} exceeds maximum size limit`,
          });
        }
      }

      if (voiceover.size > maxSize) {
        return res.status(400).json({
          error: "Audio file too large",
          message: `Audio file exceeds maximum size limit`,
        });
      }

      // Add validated data to request
      req.videoData = {
        images,
        voiceover,
        imageCount: images.length,
      };

      next();
    } catch (error) {
      return res.status(500).json({
        error: "Validation failed",
        message: error.message,
      });
    }
  }

  // Error handling middleware for multer
  handleUploadError(err, req, res, next) {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: "File too large",
          message: "Uploaded file exceeds the maximum allowed size",
        });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          error: "Too many files",
          message: "Too many files uploaded",
        });
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({
          error: "Unexpected file field",
          message: "Unexpected file field in upload",
        });
      }
    }

    if (err) {
      return res.status(400).json({
        error: "Upload failed",
        message: err.message,
      });
    }

    next();
  }
}

module.exports = VideoMiddleware;
