const { Router } = require("express");
const VideoController = require("../controllers/video.controller.js");
const VideoMiddleware = require("../middleware/video.middleware.js");

const router = Router();
const videoController = new VideoController();
const videoMiddleware = new VideoMiddleware();

function setVideoRoutes(app) {
  // Video generation routes
  router.post(
    "/generate",
    videoMiddleware.uploadFiles(),
    videoMiddleware.handleUploadError,
    videoMiddleware.validateVideoRequest,
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
}

module.exports = setVideoRoutes;
