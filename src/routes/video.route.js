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
