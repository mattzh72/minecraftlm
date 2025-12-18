import { useRef, useCallback, useEffect } from 'react';
import { mat4, vec3 } from '../utils/deepslate';
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

  // Rotate view (change yaw/pitch - camera rotates in place)
  // Drag right → look right, drag up → look up
  const pan = useCallback((direction, sensitivity = 1) => {
    cameraState.current.yaw -= (direction[0] / cam.panSensitivity) * sensitivity;
    cameraState.current.pitch += (direction[1] / cam.panSensitivity) * sensitivity;
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

  // Zoom camera (move forward/backward in look direction)
  const zoom = useCallback((delta) => {
    const { position, pitch, yaw } = cameraState.current;
    if (!position) return;

    // Move in look direction
    const zoomFactor = Math.max(0.1, cameraState.current.radius * 0.05);
    const zoomAmount = delta * zoomFactor * 0.01;

    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const sinYaw = Math.sin(yaw);
    const cosYaw = Math.cos(yaw);

    // Move in the direction camera is looking
    position[0] += -sinYaw * cosPitch * zoomAmount;
    position[1] += -sinPitch * zoomAmount;
    position[2] += -cosYaw * cosPitch * zoomAmount;
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
