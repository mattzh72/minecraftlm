import { useEffect, useRef, useCallback } from 'react';
import { vec3 } from '../utils/deepslate';

const BASE_MOVE_SPEED = 0.15; // Base speed for first-person movement

/**
 * Hook to handle keyboard controls for first-person camera movement
 * WASD moves the camera position in the direction you're facing
 * Space/Shift moves up/down
 * Uses a single animation frame loop to avoid conflicts with mouse controls
 */
export default function useKeyboardControls(camera, requestRender, enabled = true) {
  const pressedKeysRef = useRef(new Set());
  const animationFrameRef = useRef(null);
  const isRunningRef = useRef(false);

  // Movement update function - updates camera position and schedules next frame
  const tick = useCallback(() => {
    const keys = pressedKeysRef.current;
    if (keys.size === 0 || !isRunningRef.current) {
      animationFrameRef.current = null;
      isRunningRef.current = false;
      return;
    }

    const { yaw, position } = camera.cameraState.current;
    if (!position) return;

    const moveSpeed = BASE_MOVE_SPEED;

    // Forward direction - where camera is looking (horizontal only)
    // Camera looks in -sin(yaw), -cos(yaw) direction
    const forwardX = -Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);

    // Right direction (perpendicular to forward)
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);

    const direction = vec3.create();

    // W/S: move forward/backward
    if (keys.has('w') || keys.has('arrowup')) {
      direction[0] += forwardX * moveSpeed;
      direction[2] += forwardZ * moveSpeed;
    }
    if (keys.has('s') || keys.has('arrowdown')) {
      direction[0] -= forwardX * moveSpeed;
      direction[2] -= forwardZ * moveSpeed;
    }

    // A/D: strafe left/right
    if (keys.has('a') || keys.has('arrowleft')) {
      direction[0] -= rightX * moveSpeed;
      direction[2] -= rightZ * moveSpeed;
    }
    if (keys.has('d') || keys.has('arrowright')) {
      direction[0] += rightX * moveSpeed;
      direction[2] += rightZ * moveSpeed;
    }

    // Space/Shift: up/down (world Y)
    if (keys.has(' ')) direction[1] = moveSpeed;
    if (keys.has('shift')) direction[1] = -moveSpeed;

    // Move camera position directly
    vec3.add(position, position, direction);

    // Request render through the shared render system
    requestRender();

    // Schedule next tick
    animationFrameRef.current = requestAnimationFrame(tick);
  }, [camera, requestRender]);

  // Start the animation loop
  const startLoop = useCallback(() => {
    if (!isRunningRef.current && pressedKeysRef.current.size > 0) {
      isRunningRef.current = true;
      animationFrameRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  useEffect(() => {
    if (!camera || !requestRender || !enabled) {
      pressedKeysRef.current.clear();
      isRunningRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key.toLowerCase();
      const movementKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '];

      if (movementKeys.includes(key) || e.key === 'Shift') {
        e.preventDefault();
        pressedKeysRef.current.add(key);
        startLoop();
      }
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();
      pressedKeysRef.current.delete(key);
      // Loop will stop itself when no keys are pressed
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      isRunningRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      pressedKeysRef.current.clear();
    };
  }, [camera, requestRender, enabled, startLoop]);
}
