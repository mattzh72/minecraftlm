import { useEffect, useRef } from 'react';
import { vec3 } from '../utils/deepslate';

const MOVE_SPEED = 0.3;

/**
 * Hook to handle keyboard controls for orbit camera movement
 * WASD moves relative to camera view, Shift/Space for vertical
 */
export default function useKeyboardControls(camera, render, enabled = true) {
  const pressedKeysRef = useRef(new Set());
  const animationFrameRef = useRef(null);

  useEffect(() => {
    if (!camera || !render || !enabled) {
      pressedKeysRef.current.clear();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const updatePosition = () => {
      const keys = pressedKeysRef.current;
      if (keys.size === 0) {
        animationFrameRef.current = null;
        return;
      }

      // Get camera yaw to compute view-relative directions
      const { yaw } = camera.cameraState.current;

      // Forward direction (where camera looks) in world space
      // Camera looks toward: [-sin(yaw), 0, -cos(yaw)]
      const forwardX = -Math.sin(yaw);
      const forwardZ = -Math.cos(yaw);

      // Right direction (perpendicular to forward)
      const rightX = -forwardZ; // cos(yaw)
      const rightZ = forwardX;  // -sin(yaw)

      const direction = vec3.create();

      // W/S: forward/backward
      if (keys.has('w') || keys.has('arrowup')) {
        direction[0] += forwardX * MOVE_SPEED;
        direction[2] += forwardZ * MOVE_SPEED;
      }
      if (keys.has('s') || keys.has('arrowdown')) {
        direction[0] -= forwardX * MOVE_SPEED;
        direction[2] -= forwardZ * MOVE_SPEED;
      }

      // A/D: strafe left/right
      if (keys.has('a') || keys.has('arrowleft')) {
        direction[0] -= rightX * MOVE_SPEED;
        direction[2] -= rightZ * MOVE_SPEED;
      }
      if (keys.has('d') || keys.has('arrowright')) {
        direction[0] += rightX * MOVE_SPEED;
        direction[2] += rightZ * MOVE_SPEED;
      }

      // Shift/Space: up/down (world Y)
      if (keys.has('shift')) direction[1] = MOVE_SPEED;
      if (keys.has(' ')) direction[1] = -MOVE_SPEED;

      // Move target directly (don't use move3d rotation)
      const { target } = camera.cameraState.current;
      if (target) {
        vec3.add(target, target, direction);
      }

      render();
      animationFrameRef.current = requestAnimationFrame(updatePosition);
    };

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key.toLowerCase();
      const movementKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '];

      if (movementKeys.includes(key) || e.key === 'Shift') {
        e.preventDefault();
        pressedKeysRef.current.add(key);

        if (!animationFrameRef.current) {
          animationFrameRef.current = requestAnimationFrame(updatePosition);
        }
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      pressedKeysRef.current.delete(key);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      pressedKeysRef.current.clear();
    };
  }, [camera, render, enabled]);
}
