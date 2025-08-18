const { Router } = require("express");
const IndexController = require("../controllers/index.js");

const router = Router();
const indexController = new IndexController();

function setRoutes(app) {
  app.use("/", router);
  router.get("/", indexController.getIndex.bind(indexController));
}

module.exports = setRoutes;
