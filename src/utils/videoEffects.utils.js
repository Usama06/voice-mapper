const ffmpeg = require("fluent-ffmpeg");
const {
  VIDEO_TRANSITIONS,
  VIDEO_MOTION_EFFECTS,
  VIDEO_COLOR_EFFECTS,
  VIDEO_OVERLAY_EFFECTS,
  VIDEO_EFFECT_PRESETS,
  VIDEO_CONFIG_DEFAULTS,
} = require("../constants/constants");

class VideoEffectsUtils {
  static getAvailableEffects() {
    return {
      transitions: VIDEO_TRANSITIONS,
      motionEffects: VIDEO_MOTION_EFFECTS,
      colorEffects: VIDEO_COLOR_EFFECTS,
      overlayEffects: VIDEO_OVERLAY_EFFECTS,
    };
  }

  static getEffectPresets() {
    return VIDEO_EFFECT_PRESETS;
  }

  // Generate transition effects between images
  static generateTransitionFilter(
    fromIndex,
    toIndex,
    transitionType,
    duration = 1.0
  ) {
    const effectMap = {
      fade: `[v${fromIndex}][v${toIndex}]xfade=transition=fade:duration=${duration}:offset=0[trans${toIndex}]`,

      crossfade: `[v${fromIndex}][v${toIndex}]xfade=transition=fadeblack:duration=${duration}:offset=0[trans${toIndex}]`,

      wipeleft: `[v${fromIndex}][v${toIndex}]xfade=transition=wipeleft:duration=${duration}:offset=0[trans${toIndex}]`,

      wiperight: `[v${fromIndex}][v${toIndex}]xfade=transition=wiperight:duration=${duration}:offset=0[trans${toIndex}]`,

      wipeup: `[v${fromIndex}][v${toIndex}]xfade=transition=wipeup:duration=${duration}:offset=0[trans${toIndex}]`,

      wipedown: `[v${fromIndex}][v${toIndex}]xfade=transition=wipedown:duration=${duration}:offset=0[trans${toIndex}]`,

      slideup: `[v${fromIndex}][v${toIndex}]xfade=transition=slideup:duration=${duration}:offset=0[trans${toIndex}]`,

      slidedown: `[v${fromIndex}][v${toIndex}]xfade=transition=slidedown:duration=${duration}:offset=0[trans${toIndex}]`,

      slideleft: `[v${fromIndex}][v${toIndex}]xfade=transition=slideleft:duration=${duration}:offset=0[trans${toIndex}]`,

      slideright: `[v${fromIndex}][v${toIndex}]xfade=transition=slideright:duration=${duration}:offset=0[trans${toIndex}]`,

      circlecrop: `[v${fromIndex}][v${toIndex}]xfade=transition=circlecrop:duration=${duration}:offset=0[trans${toIndex}]`,

      dissolve: `[v${fromIndex}][v${toIndex}]xfade=transition=dissolve:duration=${duration}:offset=0[trans${toIndex}]`,
    };

    return effectMap[transitionType] || effectMap.fade;
  }

  // Generate motion effects for individual images
  static generateMotionFilter(
    imageIndex,
    motionType,
    width,
    height,
    duration,
    fps = 30
  ) {
    const totalFrames = duration * fps;

    const effectMap = {
      kenburns: `[${imageIndex}:v]scale=${width * 1.5}:${
        height * 1.5
      }:force_original_aspect_ratio=increase,crop=${width}:${height},zoompan=z='min(1.0+0.0015*on,1.2)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}[v${imageIndex}]`,

      zoom_in: `[${imageIndex}:v]scale=${width * 1.4}:${
        height * 1.4
      }:force_original_aspect_ratio=increase,crop=${width}:${height},zoompan=z='1+(0.4*on/${totalFrames})':x='(iw-ow)/2':y='(ih-oh)/2':d=${totalFrames}:s=${width}x${height}[v${imageIndex}]`,

      zoom_out: `[${imageIndex}:v]scale=${width * 1.4}:${
        height * 1.4
      }:force_original_aspect_ratio=increase,crop=${width}:${height},zoompan=z='1.4-(0.4*on/${totalFrames})':x='(iw-ow)/2':y='(ih-oh)/2':d=${totalFrames}:s=${width}x${height}[v${imageIndex}]`,

      pan_left: `[${imageIndex}:v]scale=${width * 1.3}:${
        height * 1.3
      }:force_original_aspect_ratio=increase,crop=${width}:${height},zoompan=z=1.0:x='if(gte(on,1),on*2,0)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}[v${imageIndex}]`,

      pan_right: `[${imageIndex}:v]scale=${width * 1.3}:${
        height * 1.3
      }:force_original_aspect_ratio=increase,crop=${width}:${height},zoompan=z=1.0:x='iw-on*2':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${width}x${height}[v${imageIndex}]`,

      pan_up: `[${imageIndex}:v]scale=${width * 1.3}:${
        height * 1.3
      }:force_original_aspect_ratio=increase,crop=${width}:${height},zoompan=z=1.0:x='iw/2-(iw/zoom/2)':y='if(gte(on,1),on*2,0)':d=${totalFrames}:s=${width}x${height}[v${imageIndex}]`,

      pan_down: `[${imageIndex}:v]scale=${width * 1.3}:${
        height * 1.3
      }:force_original_aspect_ratio=increase,crop=${width}:${height},zoompan=z=1.0:x='iw/2-(iw/zoom/2)':y='ih-on*2':d=${totalFrames}:s=${width}x${height}[v${imageIndex}]`,

      rotate_clockwise: `[${imageIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},rotate=a='PI*2*t/${duration}':c=black:ow=${width}:oh=${height}[v${imageIndex}]`,

      rotate_counter: `[${imageIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},rotate=a='-PI*2*t/${duration}':c=black:ow=${width}:oh=${height}[v${imageIndex}]`,

      shake: `[${imageIndex}:v]scale=${width * 1.1}:${
        height * 1.1
      }:force_original_aspect_ratio=increase,crop=${width}:${height},zoompan=z=1.0:x='iw/2-(iw/zoom/2)+sin(t*10)*5':y='ih/2-(ih/zoom/2)+cos(t*8)*3':d=${totalFrames}:s=${width}x${height}[v${imageIndex}]`,

      static: `[${imageIndex}:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}[v${imageIndex}]`,
    };

    return effectMap[motionType] || effectMap.static;
  }

  // Generate color grading effects
  static generateColorFilter(inputLabel, colorEffect) {
    const effectMap = {
      vintage: `${inputLabel}curves=vintage,colorbalance=rs=0.1:gs=-0.1:bs=-0.1:rm=0.05:gm=0:bm=-0.05[colored]`,

      sepia: `${inputLabel}colorchannelmixer=0.393:0.769:0.189:0:0.349:0.686:0.168:0:0.272:0.534:0.131[colored]`,

      black_white: `${inputLabel}hue=s=0[colored]`,

      high_contrast: `${inputLabel}curves=all='0/0 0.4/0.3 0.6/0.7 1/1'[colored]`,

      low_contrast: `${inputLabel}curves=all='0/0.1 0.4/0.45 0.6/0.55 1/0.9'[colored]`,

      warm: `${inputLabel}colortemperature=temperature=3000[colored]`,

      cool: `${inputLabel}colortemperature=temperature=7000[colored]`,

      vibrant: `${inputLabel}vibrance=intensity=0.5,saturation=1.3[colored]`,

      desaturated: `${inputLabel}hue=s=0.3[colored]`,

      film_grain: `${inputLabel}noise=alls=20:allf=t+u,unsharp=5:5:0.8:3:3:0.4[colored]`,

      vignette: `${inputLabel}vignette=PI/4[colored]`,
    };

    return effectMap[colorEffect] || `${inputLabel}copy[colored]`;
  }

  // Generate overlay effects
  static generateOverlayFilter(inputLabel, overlayEffect, width, height) {
    const effectMap = {
      particles: `${inputLabel}drawbox=x=0:y=0:w=${width}:h=${height}:color=white@0.1:t=fill,noise=alls=10:allf=t[colored]`,

      light_leaks: `color=orange:duration=1:size=${width}x${height}[light];[light]geq=lum='if(gt(random(1),0.98),255,0)':cb=128:cr=128[leak];${inputLabel}[leak]blend=all_mode=screen:all_opacity=0.3[colored]`,

      dust: `${inputLabel}noise=alls=5:allf=t,unsharp=5:5:0.5:3:3:0.2[colored]`,

      scratches: `${inputLabel}drawbox=x=random(1)*${width}:y=0:w=1:h=${height}:color=white@0.5:t=fill,drawbox=x=random(1)*${width}:y=0:w=1:h=${height}:color=black@0.3:t=fill[colored]`,

      bokeh: `${inputLabel}gblur=sigma=1:steps=1[colored]`,

      lens_flare: `color=white:duration=1:size=${width}x${height}[flare];[flare]geq=lum='if(hypot(X-${width}/2,Y-${height}/2)<50,255-hypot(X-${width}/2,Y-${height}/2)*3,0)':cb=128:cr=128[lens];${inputLabel}[lens]blend=all_mode=screen:all_opacity=0.2[colored]`,

      rain: `${inputLabel}drawbox=x=random(1)*${width}:y=random(1)*${height}:w=1:h=5:color=white@0.7:t=fill[colored]`,

      snow: `${inputLabel}drawbox=x=random(1)*${width}:y=random(1)*${height}:w=2:h=2:color=white@0.8:t=fill[colored]`,
    };

    return effectMap[overlayEffect] || `${inputLabel}copy[colored]`;
  }

  // Create a complete video command with effects
  static createVideoWithEffects(
    imagePaths,
    audioPath,
    outputPath,
    audioDuration,
    effects = {}
  ) {
    const config = VIDEO_CONFIG_DEFAULTS;
    const imageDuration = audioDuration / imagePaths.length;

    const command = ffmpeg();

    // Add image inputs
    imagePaths.forEach((imagePath) => {
      command.input(imagePath);
    });

    // Add audio input
    command.input(audioPath);

    const videoFilters = [];

    // Generate filters for each image with fade in/out for smooth transitions
    imagePaths.forEach((_, index) => {
      const fadeOutStart =
        imageDuration - (index === imagePaths.length - 1 ? 0 : 0.5); // End fade-out

      let totalFrames = Math.round(imageDuration * config.fps);
      let filterChain =
        `[${index}:v]scale=${config.width * 1.4}:${
          config.height * 1.4
        }:force_original_aspect_ratio=increase,` +
        `crop=${config.width}:${config.height},` +
        `setpts=PTS-STARTPTS,` +
        `zoompan=z='1+(0.4*on/${totalFrames})':d=${totalFrames}:` +
        `x='(iw-ow)/2':y='(ih-oh)/2':s=${config.width}x${config.height}:fps=${config.fps}`;

      // Add fade effects for smooth transitions (except for single image)
      if (imagePaths.length > 1) {
        if (index === 0) {
          // First image: fade out at the end
          filterChain += `,fade=t=out:st=${fadeOutStart}:d=0.5`;
        } else if (index === imagePaths.length - 1) {
          // Last image: fade in at the start
          filterChain += `,fade=t=in:st=0:d=0.5`;
        } else {
          // Middle images: fade in and out
          filterChain += `,fade=t=in:st=0:d=0.5,fade=t=out:st=${fadeOutStart}:d=0.5`;
        }
      }

      filterChain += `[v${index}]`;
      videoFilters.push(filterChain);
    });

    // Concatenation with proper timing
    if (imagePaths.length === 1) {
      videoFilters.push(`[v0]copy[outv]`);
    } else {
      const concatInputs = imagePaths.map((_, index) => `[v${index}]`).join("");
      const concatFilter = `${concatInputs}concat=n=${imagePaths.length}:v=1:a=0[outv]`;
      videoFilters.push(concatFilter);
    }

    command.complexFilter(videoFilters, ["outv"]);

    command
      .outputOptions([
        `-map`,
        `${imagePaths.length}:a`,
        `-c:v`,
        config.videoCodec,
        `-c:a`,
        config.audioCodec,
        `-preset`,
        config.preset,
        `-crf`,
        config.crf.toString(),
        `-r`,
        config.fps.toString(),
        `-movflags`,
        `+faststart`,
        `-shortest`,
      ])
      .output(outputPath);

    return command;
  }

  // Validate effect options
  static validateEffects(effects) {
    const available = VideoEffectsUtils.getAvailableEffects();
    const errors = [];

    if (
      effects.transition &&
      !available.transitions.includes(effects.transition)
    ) {
      errors.push(`Invalid transition effect: ${effects.transition}`);
    }

    if (effects.motion && !available.motionEffects.includes(effects.motion)) {
      errors.push(`Invalid motion effect: ${effects.motion}`);
    }

    if (effects.color && !available.colorEffects.includes(effects.color)) {
      errors.push(`Invalid color effect: ${effects.color}`);
    }

    if (
      effects.overlay &&
      !available.overlayEffects.includes(effects.overlay)
    ) {
      errors.push(`Invalid overlay effect: ${effects.overlay}`);
    }

    if (effects.preset) {
      const presets = VideoEffectsUtils.getEffectPresets();
      if (!presets[effects.preset]) {
        errors.push(`Invalid effect preset: ${effects.preset}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Apply preset effects
  static applyPreset(presetName) {
    const presets = VideoEffectsUtils.getEffectPresets();
    const preset = presets[presetName];

    if (!preset) {
      throw new Error(`Preset '${presetName}' not found`);
    }

    return {
      transition: preset.transition,
      motion: preset.motion,
      color: preset.color,
      overlay: preset.overlay,
      transitionDuration: 0.8,
      description: preset.description,
    };
  }
}

module.exports = VideoEffectsUtils;
