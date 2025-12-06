import { useRef, useCallback, useEffect } from 'react';
import { mat4, vec3 } from '../utils/deepslate';

/**
 * Hook to manage camera state and movement
 * Returns camera state and movement functions
 */
export default function useCamera(structureSize) {
  // Use refs for mutable camera state (avoids re-renders on every frame)
  const cameraState = useRef({
    viewDist: 12,
    xRotation: 0.7,
    yRotation: 0.8,
    cameraPos: null,
  });

  // Initialize camera position when structure size changes
  useEffect(() => {
    if (structureSize) {
      const maxDim = Math.max(structureSize[0], structureSize[1], structureSize[2]);
      const pos = vec3.create();
      vec3.set(pos, -structureSize[0] / 2, -structureSize[1] / 2, -structureSize[2] / 2);
      cameraState.current.cameraPos = pos;
      // Reset rotation and distance when structure changes
      cameraState.current.xRotation = 0.7;
      cameraState.current.yRotation = 0.8;
      cameraState.current.viewDist = Math.max(8, maxDim * 1.8);
    }
  }, [structureSize]);

  // Get view matrix for rendering
  const getViewMatrix = useCallback(() => {
    const { xRotation, yRotation, cameraPos, viewDist } = cameraState.current;

    // Clamp rotation values
    cameraState.current.yRotation = yRotation % (Math.PI * 2);
    cameraState.current.xRotation = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, xRotation));
    cameraState.current.viewDist = Math.max(4, Math.min(200, viewDist));

    const view = mat4.create();
    // Pull camera back, then apply isometric-ish rotation and center the structure
    mat4.translate(view, view, [0, 0, -cameraState.current.viewDist]);
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
