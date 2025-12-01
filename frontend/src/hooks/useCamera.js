import { useRef, useCallback, useEffect } from 'react';
import { mat4, vec3 } from '../utils/deepslate';

/**
 * Hook to manage camera state and movement
 * Returns camera state and movement functions
 */
export default function useCamera(structureSize) {
  // Use refs for mutable camera state (avoids re-renders on every frame)
  const cameraState = useRef({
    viewDist: 4,
    xRotation: 0.8,
    yRotation: 0.5,
    cameraPos: null,
  });

  // Initialize camera position when structure size changes
  useEffect(() => {
    if (structureSize) {
      const pos = vec3.create();
      vec3.set(pos, -structureSize[0] / 2, -structureSize[1] / 2, -structureSize[2] / 2);
      cameraState.current.cameraPos = pos;
      // Reset rotation when structure changes
      cameraState.current.xRotation = 0.8;
      cameraState.current.yRotation = 0.5;
      cameraState.current.viewDist = 4;
    }
  }, [structureSize]);

  // Get view matrix for rendering
  const getViewMatrix = useCallback(() => {
    const { xRotation, yRotation, cameraPos } = cameraState.current;

    // Clamp rotation values
    cameraState.current.yRotation = yRotation % (Math.PI * 2);
    cameraState.current.xRotation = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, xRotation));
    cameraState.current.viewDist = Math.max(1, Math.min(20, cameraState.current.viewDist));

    const view = mat4.create();
    mat4.rotateX(view, view, cameraState.current.xRotation);
    mat4.rotateY(view, view, cameraState.current.yRotation);
    if (cameraPos) {
      mat4.translate(view, view, cameraPos);
    }

    return view;
  }, []);

  // Move camera in 3D space
  const move3d = useCallback((direction, relativeVertical = true, sensitivity = 1) => {
    const { xRotation, yRotation, cameraPos } = cameraState.current;
    if (!cameraPos) return;

    const offset = vec3.create();
    vec3.set(
      offset,
      direction[0] * sensitivity,
      direction[1] * sensitivity,
      direction[2] * sensitivity
    );

    if (relativeVertical) {
      vec3.rotateX(offset, offset, [0, 0, 0], -xRotation * sensitivity);
    }
    vec3.rotateY(offset, offset, [0, 0, 0], -yRotation * sensitivity);
    vec3.add(cameraPos, cameraPos, offset);
  }, []);

  // Pan camera (rotate view)
  const pan = useCallback((direction, sensitivity = 1) => {
    cameraState.current.yRotation += (direction[0] / 200) * sensitivity;
    cameraState.current.xRotation += (direction[1] / 200) * sensitivity;
  }, []);

  // Zoom camera
  const zoom = useCallback((delta) => {
    cameraState.current.viewDist += delta;
  }, []);

  return {
    cameraState,
    getViewMatrix,
    move3d,
    pan,
    zoom,
  };
}
