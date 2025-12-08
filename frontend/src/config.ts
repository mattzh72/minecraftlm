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
    zoomSensitivity: 0.02,
  },
  renderer: {
    chunkSize: 8,
  },
  thumbnail: {
    defaultSize: 200,
    distanceMultiplier: 1.5,
    tiltAngle: 0.6,
    rotateAngle: 0.8,
    fallbackDimension: 16,
  },
} as const;
