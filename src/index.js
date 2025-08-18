require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const setVideoRoutes = require("./routes/video.route");

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
setVideoRoutes(app);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
