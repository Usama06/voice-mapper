// Video Effects Constants
// Transition effects available for video generation
const VIDEO_TRANSITIONS = [
  "fade",
  "crossfade",
  "wipeleft",
  "wiperight",
  "wipeup",
  "wipedown",
  "slideup",
  "slidedown",
  "slideleft",
  "slideright",
  "circlecrop",
  "rectcrop",
  "dissolve",
];

// Motion effects for individual images
const VIDEO_MOTION_EFFECTS = [
  "kenburns",
  "zoom_in",
  "zoom_out",
  "pan_left",
  "pan_right",
  "pan_up",
  "pan_down",
  "rotate_clockwise",
  "rotate_counter",
  "shake",
  "static",
];

// Color grading and filter effects
const VIDEO_COLOR_EFFECTS = [
  "vintage",
  "sepia",
  "black_white",
  "high_contrast",
  "low_contrast",
  "warm",
  "cool",
  "vibrant",
  "desaturated",
  "film_grain",
  "vignette",
];

// Overlay effects for additional visual elements
const VIDEO_OVERLAY_EFFECTS = [
  "particles",
  "light_leaks",
  "dust",
  "scratches",
  "bokeh",
  "lens_flare",
  "rain",
  "snow",
];

// Predefined effect combinations (presets)
const VIDEO_EFFECT_PRESETS = {
  cinematic: {
    transition: "fade",
    motion: "kenburns",
    color: "vintage",
    overlay: "light_leaks",
    description: "Cinematic look with warm tones and subtle movement",
  },
  modern: {
    transition: "crossfade",
    motion: "zoom_in",
    color: "high_contrast",
    overlay: null,
    description: "Clean modern style with sharp contrasts",
  },
  nostalgic: {
    transition: "dissolve",
    motion: "pan_right",
    color: "sepia",
    overlay: "scratches",
    description: "Vintage nostalgic feel with sepia tones",
  },
  dynamic: {
    transition: "slideright",
    motion: "shake",
    color: "vibrant",
    overlay: "particles",
    description: "High-energy dynamic presentation",
  },
  minimal: {
    transition: "fade",
    motion: "static",
    color: "black_white",
    overlay: null,
    description: "Clean minimal black and white style",
  },
  nature: {
    transition: "wipeleft",
    motion: "zoom_out",
    color: "cool",
    overlay: "bokeh",
    description: "Natural outdoor feeling with cool tones",
  },
};

// Video configuration defaults
const VIDEO_CONFIG_DEFAULTS = {
  width: 1920,
  height: 1080,
  fps: 30,
  videoCodec: "libx264",
  audioCodec: "aac",
  preset: "medium",
  crf: 23,
  transitionDuration: 0.8,
};

// Supported file formats
const SUPPORTED_IMAGE_FORMATS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".bmp",
  ".gif",
  ".tiff",
  ".webp",
];
const SUPPORTED_AUDIO_FORMATS = [
  ".mp3",
  ".wav",
  ".aac",
  ".m4a",
  ".ogg",
  ".flac",
];

// Upload Configuration Constants
const UPLOAD_DESTINATIONS = {
  images: "./uploads/images",
  voiceover: "./uploads/audio",
};

const ALLOWED_FILE_TYPES = {
  images: ["image/jpeg", "image/png", "image/gif", "image/bmp", "image/webp"],
  voiceover: ["audio/mpeg", "audio/wav", "audio/mp3", "audio/aac", "audio/ogg"],
};

const UPLOAD_FIELD_CONFIGS = [
  {
    name: "images",
    maxCount: parseInt(process.env.MAX_IMAGE_COUNT, 10) || 10,
  },
  {
    name: "voiceover",
    maxCount: parseInt(process.env.MAX_AUDIO_COUNT, 10) || 1,
  },
];

// Export all constants
module.exports = {
  VIDEO_TRANSITIONS,
  VIDEO_MOTION_EFFECTS,
  VIDEO_COLOR_EFFECTS,
  VIDEO_OVERLAY_EFFECTS,
  VIDEO_EFFECT_PRESETS,
  VIDEO_CONFIG_DEFAULTS,
  SUPPORTED_IMAGE_FORMATS,
  SUPPORTED_AUDIO_FORMATS,
  UPLOAD_DESTINATIONS,
  ALLOWED_FILE_TYPES,
  UPLOAD_FIELD_CONFIGS,
};
