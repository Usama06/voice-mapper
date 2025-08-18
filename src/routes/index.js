const { Router } = require("express");
const IndexController = require("../controllers/index.js");
const VideoController = require("../controllers/VideoController.js");

const router = Router();
const indexController = new IndexController();
const videoController = new VideoController();

function setRoutes(app) {
  app.use("/", router);
  app.use("/api", router);

  // Basic routes
  router.get("/", indexController.getIndex.bind(indexController));

  // Video generation routes
  router.post(
    "/video/generate",
    videoController.uploadFiles(),
    videoController.generateVideo.bind(videoController)
  );

  router.get(
    "/video/download/:filename",
    videoController.downloadVideo.bind(videoController)
  );
  router.get(
    "/video/preview/:filename",
    videoController.previewVideo.bind(videoController)
  );
  router.get(
    "/video/mappings",
    videoController.getMappings.bind(videoController)
  );
}

module.exports = setRoutes;
