import { useRef, useCallback, useEffect } from 'react';
import { mat4, vec3 } from '../utils/deepslate';
import { Config } from '../config';

const { playable } = Config;

/**
 * Hook to manage first-person camera state
 * Position is the eye position, yaw/pitch control look direction
 */
export default function useFirstPersonCamera(structureSize) {
  const cameraState = useRef({
    position: vec3.fromValues(0, 10, 0),
    yaw: 0,    // horizontal rotation (radians)
    pitch: 0,  // vertical rotation (radians)
  });

  // Initialize position above structure center when structure size changes
  useEffect(() => {
    if (structureSize) {
      const centerX = structureSize[0] / 2;
      const centerZ = structureSize[2] / 2;
      // Spawn above the structure
      const spawnY = structureSize[1] + playable.spawnHeightOffset + playable.playerHeight;

      cameraState.current.position = vec3.fromValues(centerX, spawnY, centerZ);
      cameraState.current.yaw = 0;
      cameraState.current.pitch = -0.5; // Look slightly down to see the structure
    }
  }, [structureSize]);

  // Get view matrix for rendering
  const getViewMatrix = useCallback(() => {
    const { position, yaw, pitch } = cameraState.current;

    // Clamp pitch to prevent flipping
    const clampedPitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
    cameraState.current.pitch = clampedPitch;

    // Compute forward direction from yaw and pitch
    const cosPitch = Math.cos(clampedPitch);
    const sinPitch = Math.sin(clampedPitch);
    const sinYaw = Math.sin(yaw);
    const cosYaw = Math.cos(yaw);

    // Forward direction (where we're looking)
    const forward = vec3.fromValues(
      cosPitch * sinYaw,
      sinPitch,
      cosPitch * cosYaw
    );

    // Target point = position + forward
    const target = vec3.create();
    vec3.add(target, position, forward);

    const view = mat4.create();
    mat4.lookAt(view, position, target, [0, 1, 0]);

    return view;
  }, []);

  // Update look direction from mouse movement
  const look = useCallback((deltaX, deltaY) => {
    // Flip horizontal input so moving mouse right turns view right
    cameraState.current.yaw -= deltaX * playable.lookSensitivity;
    cameraState.current.pitch -= deltaY * playable.lookSensitivity;

    // Clamp pitch
    cameraState.current.pitch = Math.max(
      -Math.PI / 2 + 0.01,
      Math.min(Math.PI / 2 - 0.01, cameraState.current.pitch)
    );
  }, []);

  // Set position directly (used by physics)
  const setPosition = useCallback((newPosition) => {
    vec3.copy(cameraState.current.position, newPosition);
  }, []);

  // Get forward and right vectors for movement
  const getMovementVectors = useCallback(() => {
    const { yaw } = cameraState.current;

    // Forward direction (horizontal only, ignore pitch for movement)
    const forward = vec3.fromValues(
      Math.sin(yaw),
      0,
      Math.cos(yaw)
    );

    // Right direction
    const right = vec3.fromValues(
      Math.cos(yaw),
      0,
      -Math.sin(yaw)
    );

    return { forward, right };
  }, []);

  // Re-initialize camera (e.g., when switching modes or respawning)
  const reset = useCallback(() => {
    if (structureSize) {
      const centerX = structureSize[0] / 2;
      const centerZ = structureSize[2] / 2;
      const spawnY = structureSize[1] + playable.spawnHeightOffset + playable.playerHeight;

      cameraState.current.position = vec3.fromValues(centerX, spawnY, centerZ);
      cameraState.current.yaw = 0;
      cameraState.current.pitch = -0.5; // Look slightly down to see the structure
    }
  }, [structureSize]);

  return {
    cameraState,
    getViewMatrix,
    look,
    setPosition,
    getMovementVectors,
    reset,
  };
}
