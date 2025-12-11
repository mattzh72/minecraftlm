import { useRef, useCallback, useEffect } from 'react';
import { mat4, vec3 } from '../utils/deepslate';
import { Config } from '../config';

const { camera: cam } = Config;

/**
 * Hook to manage camera state and movement
 * Returns camera state and movement functions
 */
export default function useCamera(structureSize) {
  // Use refs for mutable camera state (avoids re-renders on every frame)
  const cameraState = useRef({
    radius: cam.defaultDistance,
    pitch: cam.defaultRotationX,
    yaw: cam.defaultRotationY,
    target: null,
  });

  // Initialize camera position when structure size changes
  useEffect(() => {
    if (structureSize) {
      const maxDim = Math.max(structureSize[0], structureSize[1], structureSize[2]);
      // Center of the structure in positive space; we orbit around this
      const center = vec3.fromValues(
        structureSize[0] / 2,
        structureSize[1] / 2,
        structureSize[2] / 2
      );
      cameraState.current.target = center;
      cameraState.current.pitch = cam.defaultRotationX;
      cameraState.current.yaw = cam.defaultRotationY;
      cameraState.current.radius = Math.max(cam.minDistanceFloor, maxDim * cam.distanceMultiplier);
    }
  }, [structureSize]);

  // Get view matrix for rendering
  const getViewMatrix = useCallback(() => {
    const { pitch, yaw, target } = cameraState.current;
    let { radius } = cameraState.current;
    // Clamp rotation values
    const clampedPitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
    cameraState.current.pitch = clampedPitch;
    cameraState.current.yaw = yaw % (Math.PI * 2);
    radius = Math.max(cam.minDistance, Math.min(cam.maxDistance, radius));
    cameraState.current.radius = radius;

    const focus = target ?? vec3.fromValues(0, 0, 0);
    const eye = vec3.create();
    const cosPitch = Math.cos(clampedPitch);
    const sinPitch = Math.sin(clampedPitch);
    const sinYaw = Math.sin(cameraState.current.yaw);
    const cosYaw = Math.cos(cameraState.current.yaw);

    vec3.set(
      eye,
      focus[0] + radius * cosPitch * sinYaw,
      focus[1] + radius * sinPitch,
      focus[2] + radius * cosPitch * cosYaw
    );

    const view = mat4.create();
    mat4.lookAt(view, eye, focus, [0, 1, 0]);

    return view;
  }, []);

  // Move camera in 3D space
  const move3d = useCallback((direction, relativeVertical = true, sensitivity = 1) => {
    const { pitch, yaw, target } = cameraState.current;
    if (!target) return;

    const offset = vec3.fromValues(
      direction[0] * sensitivity,
      direction[1] * sensitivity,
      direction[2] * sensitivity
    );

    if (relativeVertical) {
      vec3.rotateX(offset, offset, [0, 0, 0], -pitch);
    }
    vec3.rotateY(offset, offset, [0, 0, 0], -yaw);
    vec3.add(target, target, offset);
  }, []);

  // Rotate view (orbit)
  const pan = useCallback((direction, sensitivity = 1) => {
    cameraState.current.yaw += (direction[0] / cam.panSensitivity) * sensitivity;
    cameraState.current.pitch += (direction[1] / cam.panSensitivity) * sensitivity;
  }, []);

  // Pan target (truck/pedestal)
  const panTarget = useCallback((direction) => {
    const { target, yaw, radius } = cameraState.current;
    if (!target) return;
    const panScale = Math.max(radius * 0.0025, 0.01);
    const offset = vec3.fromValues(-direction[0] * panScale, direction[1] * panScale, 0);
    vec3.rotateY(offset, offset, [0, 0, 0], -yaw);
    vec3.add(target, target, offset);
  }, []);

  // Zoom camera
  const zoom = useCallback((delta) => {
    // Scale zoom speed with current radius for smoother feel
    const zoomFactor = Math.max(0.1, cameraState.current.radius * 0.05);
    cameraState.current.radius += delta * zoomFactor * 0.01;
  }, []);

  const reset = useCallback(() => {
    if (structureSize) {
      const center = vec3.fromValues(
        structureSize[0] / 2,
        structureSize[1] / 2,
        structureSize[2] / 2
      );
      cameraState.current.target = center;
      const maxDim = Math.max(structureSize[0], structureSize[1], structureSize[2]);
      cameraState.current.radius = Math.max(cam.minDistanceFloor, maxDim * cam.distanceMultiplier);
      cameraState.current.pitch = cam.defaultRotationX;
      cameraState.current.yaw = cam.defaultRotationY;
    }
  }, [structureSize]);

  return {
    cameraState,
    getViewMatrix,
    move3d,
    pan,
    panTarget,
    zoom,
    reset,
  };
}
