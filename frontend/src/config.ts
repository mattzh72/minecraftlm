export const Config = {
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
    zoomSensitivity: 1,
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
          radius: 0.6,
        },
        godRays: {
          enabled: true,
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
