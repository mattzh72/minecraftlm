export const Config = {
  playable: {
    // Physics
    gravity: -20,           // blocks/s^2
    jumpVelocity: 8,        // blocks/s
    moveSpeed: 5.5,         // blocks/s (slightly faster for snappier feel)
    terminalVelocity: -78,  // max fall speed
    // Player dimensions
    playerHeight: 1.62,     // eye level above feet
    playerWidth: 0.6,       // hitbox width
    playerDepth: 0.6,       // hitbox depth
    // Controls
    lookSensitivity: 0.002, // mouse sensitivity
    // Spawn
    spawnHeightOffset: 5,   // blocks above structure top
  },
  camera: {
    defaultDistance: 12,
    minDistance: 4,
    maxDistance: 200,
    defaultRotationX: 0.7,
    defaultRotationY: 0.8,
    distanceMultiplier: 1.8,
    minDistanceFloor: 8,
    panSensitivity: 200,
  },
  controls: {
    zoomSensitivity: 20,
  },
  renderer: {
    chunkSize: 16,
    drawDistance: 256,
    useInvisibleBlockBuffer: false,
    sunlight: {
      // Golden hour sunset - sun low on horizon
      direction: [-0.5, 0.25, 0.5],
      // Key light: rich golden warmth
      color: [1.0, 0.75, 0.45],
      // Ambient: cool blue sky fill for contrast
      ambientColor: [0.25, 0.4, 0.6],
      // Fill: purple-blue shadows (complementary to warm key)
      fillColor: [0.35, 0.28, 0.5],
      // Rim: hot orange edge lighting
      rimColor: [1.0, 0.55, 0.25],
      intensity: 1.35,
      ambientIntensity: 0.55,
      fillIntensity: 0.3,
      rimIntensity: 0.55,
      horizonFalloff: 0.7,
      exposure: 1.15,
      // Sky gradient colors
      sky: {
        zenithColor: [0.12, 0.28, 0.56],    // Deep blue at top
        horizonColor: [1.0, 0.55, 0.25],    // Warm orange at horizon
        groundColor: [0.25, 0.2, 0.25],     // Dark purple-gray below horizon
        sunGlowColor: [1.0, 0.45, 0.15],    // Orange glow around sun
        sunGlowIntensity: 0.6,
        sunGlowExponent: 6.0,
      },
      disc: {
        size: 35,
        distance: 180,
        coreColor: [1.0, 0.98, 0.9],
        glowColor: [1.0, 0.55, 0.15],
        coreIntensity: 2.8,
        glowIntensity: 3.5,
        softness: 0.25,
      },
      fog: {
        color: [0.85, 0.6, 0.4],
        density: 0.001,
        heightFalloff: 0.005,
      },
      shadow: {
        enabled: true,
        mapSize: 2048,
        bias: 0.0005,
        normalBias: 0.02,
        intensity: 0.5,
        softness: 3.0,
        frustumSize: 100,
      },
      postProcess: {
        enabled: true,
        ao: {
          enabled: true,
          intensity: 0.5,
          radius: 0.5,
          samples: 16,
        },
        bloom: {
          enabled: true,
          threshold: 0.75,
          intensity: 0.5,
          radius: 0.2,
        },
        godRays: {
          enabled: false,
          intensity: 0.35,
          decay: 0.96,
          density: 0.7,
          samples: 50,
        },
      },
    },
  },
  thumbnail: {
    defaultSize: 180,
    distanceMultiplier: 1.5,
    tiltAngle: 0.6,
    rotateAngle: 0.8,
    fallbackDimension: 16,
  },
} as const;

export type TimeOfDay = "day" | "sunset" | "night";

export const TimePresets: Record<TimeOfDay, typeof Config.renderer.sunlight> = {
  day: {
    // Noon sun - high overhead, slightly angled
    direction: [0.15, 0.95, 0.25],
    // Key light: neutral white (Minecraft-style flat lighting)
    color: [1.0, 0.9, 0.75],
    // Ambient: neutral gray fill
    ambientColor: [0.45, 0.5, 0.55],
    // Fill: neutral shadows
    fillColor: [0.35, 0.35, 0.35],
    // Rim: subtle highlight
    rimColor: [0.6, 0.6, 0.55],
    intensity: 1,
    ambientIntensity: 0.55,
    fillIntensity: 0.2,
    rimIntensity: 0.15,
    horizonFalloff: 0.1,
    exposure: 1,
    sky: {
      zenithColor: [0.5, 0.75, 1.0],
      horizonColor: [0.9, 0.85, 1.0],
      groundColor: [0.7, 0.85, 1.0],
      sunGlowColor: [1.0, 0.9, 0.7],
      sunGlowIntensity: 0.2,
      sunGlowExponent: 10.0,
      stars: { enabled: false },
    },
    disc: {
      size: 25,
      distance: 180,
      coreColor: [1.0, 0.98, 0.9],
      glowColor: [1.0, 0.9, 0.75],
      coreIntensity: 2.5,
      glowIntensity: 1.2,
      softness: 0.4,
    },
    fog: {
      color: [0.9, 0.88, 0.75],
      density: 0.0005,
      heightFalloff: 0.002,
    },
    shadow: {
      enabled: true,
      mapSize: 2048,
      bias: 0.0005,
      normalBias: 0.02,
      intensity: 0.55,
      softness: 2.0,
      frustumSize: 100,
    },
    postProcess: {
      enabled: false,
      ao: {
        enabled: false,
        intensity: 0.4,
        radius: 0.5,
        samples: 16,
      },
      bloom: {
        enabled: false,
        threshold: 0.95,
        intensity: 0.15,
        radius: 0.1,
      },
      godRays: {
        enabled: false,
        intensity: 0.35,
        decay: 0.96,
        density: 0.7,
        samples: 50,
      },
    },
  },
  sunset: {
    // Golden hour sunset - sun low on horizon
    direction: [-0.5, 0.25, 0.5],
    // Key light: rich golden warmth
    color: [1.0, 0.75, 0.45],
    // Ambient: cool blue sky fill for contrast
    ambientColor: [0.25, 0.4, 0.6],
    // Fill: purple-blue shadows (complementary to warm key)
    fillColor: [0.35, 0.28, 0.5],
    // Rim: hot orange edge lighting
    rimColor: [1.0, 0.55, 0.25],
    intensity: 1.35,
    ambientIntensity: 0.55,
    fillIntensity: 0.3,
    rimIntensity: 0.55,
    horizonFalloff: 0.7,
    exposure: 1.15,
    sky: {
      zenithColor: [0.12, 0.28, 0.56],
      horizonColor: [1.0, 0.55, 0.25],
      groundColor: [0.25, 0.2, 0.25],
      sunGlowColor: [1.0, 0.45, 0.15],
      sunGlowIntensity: 0.6,
      sunGlowExponent: 6.0,
      stars: { enabled: false },
    },
    disc: {
      size: 35,
      distance: 180,
      coreColor: [1.0, 0.98, 0.9],
      glowColor: [1.0, 0.55, 0.15],
      coreIntensity: 2.8,
      glowIntensity: 3.5,
      softness: 0.25,
    },
    fog: {
      color: [0.85, 0.6, 0.4],
      density: 0.001,
      heightFalloff: 0.005,
    },
    shadow: {
      enabled: true,
      mapSize: 2048,
      bias: 0.0005,
      normalBias: 0.02,
      intensity: 0.5,
      softness: 3.0,
      frustumSize: 100,
    },
    postProcess: {
      enabled: true,
      ao: {
        enabled: true,
        intensity: 0.5,
        radius: 0.5,
        samples: 16,
      },
      bloom: {
        enabled: true,
        threshold: 0.75,
        intensity: 0.5,
        radius: 0.2,
      },
      godRays: {
        enabled: false,
        intensity: 0.35,
        decay: 0.96,
        density: 0.7,
        samples: 50,
      },
    },
  },
  night: {
    // Moonlight from above
    direction: [0.3, 0.8, -0.2],
    // Key light: cool moonlight
    color: [0.4, 0.5, 0.7],
    // Ambient: very dark blue
    ambientColor: [0.05, 0.08, 0.15],
    // Fill: dark purple
    fillColor: [0.08, 0.06, 0.12],
    // Rim: faint silver
    rimColor: [0.3, 0.35, 0.5],
    intensity: 0.8,
    ambientIntensity: 0.3,
    fillIntensity: 0.15,
    rimIntensity: 0.25,
    horizonFalloff: 0.4,
    exposure: 0.9,
    sky: {
      zenithColor: [0.02, 0.03, 0.08],
      horizonColor: [0.05, 0.08, 0.15],
      groundColor: [0.02, 0.02, 0.03],
      sunGlowColor: [0.3, 0.35, 0.5],
      sunGlowIntensity: 0.2,
      sunGlowExponent: 4.0,
      // Stars at night
      stars: {
        enabled: true,
        density: 0.85,
        brightness: 1.5,
      },
    },
    disc: {
      size: 25,
      distance: 180,
      coreColor: [0.9, 0.92, 1.0],
      glowColor: [0.5, 0.55, 0.7],
      coreIntensity: 1.5,
      glowIntensity: 1.0,
      softness: 0.4,
    },
    fog: {
      color: [0.05, 0.08, 0.12],
      density: 0.0015,
      heightFalloff: 0.008,
    },
    shadow: {
      enabled: true,
      mapSize: 2048,
      bias: 0.0005,
      normalBias: 0.02,
      intensity: 0.3,
      softness: 4.0,
      frustumSize: 100,
    },
    postProcess: {
      enabled: true,
      ao: {
        enabled: true,
        intensity: 0.6,
        radius: 0.6,
        samples: 16,
      },
      bloom: {
        enabled: true,
        threshold: 0.6,
        intensity: 0.4,
        radius: 0.3,
      },
      godRays: {
        enabled: false,
        intensity: 0.2,
        decay: 0.96,
        density: 0.5,
        samples: 50,
      },
    },
    // Emissive lighting - prominent warm glows at night
    emissive: {
      range: 16.0,           // Large spread for cozy atmosphere
      intensity: 3.0,        // Much more noticeable
      tint: [1.0, 0.75, 0.5], // Warm orange-amber glow
    },
  },
};
