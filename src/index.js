require("dotenv").config();
const express = require("express");
const setRoutes = require("./routes/index");
const { logger, authenticate } = require("./middleware/index");

const app = express();

// Middleware setup
app.use(express.json());
app.use(logger);

// Health check route
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Voice Mapper API is running successfully",
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || "development",
  });
});

// Routes setup
setRoutes(app);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
