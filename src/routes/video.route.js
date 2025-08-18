const { Router } = require("express");
const VideoController = require("../controllers/video.controller.js");
const VideoMiddleware = require("../middleware/video.middleware.js");
const { ResponseUtils } = require("../utils");

const router = Router();
const videoController = new VideoController();
const videoMiddleware = new VideoMiddleware();

async function setVideoRoutes(app) {
  try {
    // Initialize middleware (directories, etc.)
    await videoMiddleware.initialize();

    // Video generation routes
    router.post(
      "/generate",
      videoMiddleware.uploadFiles(),
      videoMiddleware.handleUploadError.bind(videoMiddleware),
      videoMiddleware.validateVideoRequest.bind(videoMiddleware),
      videoController.generateVideo.bind(videoController)
    );

    // Video generation with effects
    router.post(
      "/generate-with-effects",
      videoMiddleware.uploadFiles(),
      videoMiddleware.handleUploadError.bind(videoMiddleware),
      videoMiddleware.validateVideoRequest.bind(videoMiddleware),
      videoController.generateVideoWithEffects.bind(videoController)
    );

    // Get available effects and presets
    router.get(
      "/effects",
      videoController.getAvailableEffects.bind(videoController)
    );

    // Preview effect configuration
    router.get(
      "/effects/preview/:effectType/:effectName",
      videoController.previewEffect.bind(videoController)
    );

    // Preview preset configuration
    router.get(
      "/effects/preset/:preset",
      (req, res, next) => {
        req.params.effectType = "preset";
        req.params.effectName = req.params.preset;
        req.query.preset = req.params.preset;
        next();
      },
      videoController.previewEffect.bind(videoController)
    );

    router.get(
      "/download/:filename",
      videoController.downloadVideo.bind(videoController)
    );

    router.get(
      "/preview/:filename",
      videoController.previewVideo.bind(videoController)
    );

    router.get("/mappings", videoController.getMappings.bind(videoController));

    // Mount video routes under /api/video
    app.use("/api/video", router);

    console.log("✅ Video routes initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize video routes:", error);
    throw error;
  }
}

module.exports = setVideoRoutes;
