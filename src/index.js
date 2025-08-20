require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const setVideoRoutes = require("./routes/video.route");
const { ResponseUtils, DirectoryUtils } = require("./utils");

const app = express();

// Middleware setup
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:8080"], // Add your frontend URLs
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/output", express.static(path.join(__dirname, "../output")));

// Health check route with ResponseUtils
app.get("/health", (req, res) => {
  return ResponseUtils.send(
    res,
    ResponseUtils.success(
      {
        status: "OK",
        port: PORT,
        environment: process.env.NODE_ENV || "development",
      },
      "Voice Mapper API is running successfully"
    )
  );
});

// Global error handler (must be after routes)
app.use(ResponseUtils.globalErrorHandler);

// Start the server
const PORT = process.env.PORT || 8000;

// Initialize application with async setup
async function startServer() {
  try {
    // Initialize directories
    await DirectoryUtils.initializeAppDirectories();

    // Setup routes (async)
    await setVideoRoutes(app);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server is running on port ${PORT}`);
      console.log(`📁 All directories initialized`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`📽️ Video API: http://localhost:${PORT}/api/video`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
