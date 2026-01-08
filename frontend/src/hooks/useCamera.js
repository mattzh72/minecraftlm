import { useRef, useCallback, useEffect } from 'react';
import { mat4, vec3 } from '../utils/lodestone';
import { Config } from '../config';

const { camera: cam } = Config;

/**
 * Hook to manage camera state and movement
 * Uses first-person camera model: position + yaw/pitch for view direction
 * Returns camera state and movement functions
 */
export default function useCamera(structureSize) {
  // Use refs for mutable camera state (avoids re-renders on every frame)
  // First-person model: position is camera location, yaw/pitch control view direction
  const cameraState = useRef({
    position: null,  // Camera location (where you are)
    pitch: cam.defaultRotationX,
    yaw: cam.defaultRotationY,
    // Keep these for compatibility with other code that may reference them
    radius: cam.defaultDistance,
    target: null,
  });

  // Initialize camera position only once when first structure loads
  const initializedRef = useRef(false);

  useEffect(() => {
    if (structureSize && !initializedRef.current) {
      initializedRef.current = true;

      const [w, h, d] = structureSize;
      const maxDim = Math.max(w, h, d);
      const center = vec3.fromValues(w / 2, h / 2, d / 2);

      // Compute initial camera position (behind and above center)
      const initialRadius = Math.max(cam.minDistanceFloor, maxDim * cam.distanceMultiplier);
      const cosPitch = Math.cos(cam.defaultRotationX);
      const sinPitch = Math.sin(cam.defaultRotationX);
      const sinYaw = Math.sin(cam.defaultRotationY);
      const cosYaw = Math.cos(cam.defaultRotationY);

      const initialPosition = vec3.fromValues(
        center[0] + initialRadius * cosPitch * sinYaw,
        center[1] + initialRadius * sinPitch,
        center[2] + initialRadius * cosPitch * cosYaw
      );

      cameraState.current.position = initialPosition;
      cameraState.current.pitch = cam.defaultRotationX;
      cameraState.current.yaw = cam.defaultRotationY;
      cameraState.current.radius = initialRadius;
      cameraState.current.target = center; // Keep for compatibility
    }
  }, [structureSize]);

  // Get view matrix for rendering (first-person style)
  const getViewMatrix = useCallback(() => {
    const { pitch, yaw, position } = cameraState.current;

    // Clamp rotation values
    const clampedPitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
    cameraState.current.pitch = clampedPitch;
    cameraState.current.yaw = yaw % (Math.PI * 2);

    const eye = position ?? vec3.fromValues(0, 0, 0);

    // Compute look direction from yaw/pitch
    // Looking in -Z direction when yaw=0, pitch=0
    const cosPitch = Math.cos(clampedPitch);
    const sinPitch = Math.sin(clampedPitch);
    const sinYaw = Math.sin(cameraState.current.yaw);
    const cosYaw = Math.cos(cameraState.current.yaw);

    // Look direction: camera looks toward -sin(yaw), sin(pitch), -cos(yaw) direction
    const lookDir = vec3.fromValues(
      -sinYaw * cosPitch,
      -sinPitch,
      -cosYaw * cosPitch
    );

    // Compute look-at point
    const lookAt = vec3.create();
    vec3.add(lookAt, eye, lookDir);

    const view = mat4.create();
    mat4.lookAt(view, eye, lookAt, [0, 1, 0]);

    return view;
  }, []);

  // Move camera position in 3D space (first-person style)
  const move3d = useCallback((direction, relativeVertical = true, sensitivity = 1) => {
    const { pitch, yaw, position } = cameraState.current;
    if (!position) return;

    const offset = vec3.fromValues(
      direction[0] * sensitivity,
      direction[1] * sensitivity,
      direction[2] * sensitivity
    );

    if (relativeVertical) {
      vec3.rotateX(offset, offset, [0, 0, 0], -pitch);
    }
    vec3.rotateY(offset, offset, [0, 0, 0], -yaw);
    vec3.add(position, position, offset);
  }, []);

  // Orbit around center point (classical orbit camera)
  // Drag right → orbit right, drag up → orbit up
  const pan = useCallback((direction, sensitivity = 1) => {
    const { target, position } = cameraState.current;
    if (!target || !position) return;

    // Update rotation angles
    cameraState.current.yaw -= (direction[0] / cam.panSensitivity) * sensitivity;
    cameraState.current.pitch += (direction[1] / cam.panSensitivity) * sensitivity;

    // Clamp pitch to avoid gimbal lock
    cameraState.current.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, cameraState.current.pitch));

    // Calculate current radius (distance from target)
    const radius = vec3.distance(position, target);
    cameraState.current.radius = radius;

    // Recalculate camera position to orbit around target
    const cosPitch = Math.cos(cameraState.current.pitch);
    const sinPitch = Math.sin(cameraState.current.pitch);
    const sinYaw = Math.sin(cameraState.current.yaw);
    const cosYaw = Math.cos(cameraState.current.yaw);

    // Position camera at radius distance from target
    position[0] = target[0] + radius * cosPitch * sinYaw;
    position[1] = target[1] + radius * sinPitch;
    position[2] = target[2] + radius * cosPitch * cosYaw;
  }, []);

  // Pan camera position (strafe left/right, move up/down)
  const panTarget = useCallback((direction) => {
    const { position, yaw, radius } = cameraState.current;
    if (!position) return;
    const panScale = Math.max(radius * 0.0025, 0.01);
    const offset = vec3.fromValues(-direction[0] * panScale, direction[1] * panScale, 0);
    vec3.rotateY(offset, offset, [0, 0, 0], -yaw);
    vec3.add(position, position, offset);
  }, []);

  // Zoom camera (change radius from center point)
  const zoom = useCallback((delta) => {
    const { position, pitch, yaw, target, radius } = cameraState.current;
    if (!position || !target) return;

    // Adjust radius
    const zoomFactor = Math.max(0.1, radius * 0.05);
    const newRadius = Math.max(cam.minDistance, Math.min(cam.maxDistance, radius + delta * zoomFactor * 0.01));
    cameraState.current.radius = newRadius;

    // Recalculate position at new radius
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const sinYaw = Math.sin(yaw);
    const cosYaw = Math.cos(yaw);

    position[0] = target[0] + newRadius * cosPitch * sinYaw;
    position[1] = target[1] + newRadius * sinPitch;
    position[2] = target[2] + newRadius * cosPitch * cosYaw;
  }, []);

  const reset = useCallback(() => {
    if (structureSize) {
      const [w, h, d] = structureSize;
      const maxDim = Math.max(w, h, d);
      const center = vec3.fromValues(w / 2, h / 2, d / 2);

      // Compute camera position (behind and above center)
      const initialRadius = Math.max(cam.minDistanceFloor, maxDim * cam.distanceMultiplier);
      const cosPitch = Math.cos(cam.defaultRotationX);
      const sinPitch = Math.sin(cam.defaultRotationX);
      const sinYaw = Math.sin(cam.defaultRotationY);
      const cosYaw = Math.cos(cam.defaultRotationY);

      const resetPosition = vec3.fromValues(
        center[0] + initialRadius * cosPitch * sinYaw,
        center[1] + initialRadius * sinPitch,
        center[2] + initialRadius * cosPitch * cosYaw
      );

      cameraState.current.position = resetPosition;
      cameraState.current.pitch = cam.defaultRotationX;
      cameraState.current.yaw = cam.defaultRotationY;
      cameraState.current.radius = initialRadius;
      cameraState.current.target = center;
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
