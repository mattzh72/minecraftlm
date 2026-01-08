import { useEffect, useRef, useCallback } from 'react';
import { vec3 } from '../utils/lodestone';

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
  const metaKeyRef = useRef(false); // Track Cmd key to ignore Shift during screenshots
  const tickRef = useRef(null);

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
    // Ignore shift when Cmd is held (for Cmd+Shift+4 screenshots)
    if (keys.has(' ')) direction[1] = moveSpeed;
    if (keys.has('shift') && !metaKeyRef.current) direction[1] = -moveSpeed;

    // Move camera position directly
    vec3.add(position, position, direction);

    // Request render through the shared render system
    requestRender();

    // Schedule next tick
    animationFrameRef.current = requestAnimationFrame(() => {
      if (tickRef.current) {
        tickRef.current();
      }
    });
  }, [camera, requestRender]);

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  // Start the animation loop
  const startLoop = useCallback(() => {
    if (!isRunningRef.current && pressedKeysRef.current.size > 0) {
      isRunningRef.current = true;
      animationFrameRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  useEffect(() => {
    const pressedKeys = pressedKeysRef.current;

    if (!camera || !requestRender || !enabled) {
      pressedKeys.clear();
      isRunningRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const handleKeyDown = (e) => {
      // Track meta key for Cmd+Shift+4 screenshot handling
      if (e.key === 'Meta') {
        metaKeyRef.current = true;
        return;
      }

      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key.toLowerCase();
      const movementKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '];

      if (movementKeys.includes(key) || e.key === 'Shift') {
        // Don't preventDefault or add shift when Cmd is held (screenshot)
        if (e.key === 'Shift' && metaKeyRef.current) {
          return;
        }
        e.preventDefault();
        pressedKeys.add(key);
        startLoop();
      }
    };

    const handleKeyUp = (e) => {
      // Track meta key release
      if (e.key === 'Meta') {
        metaKeyRef.current = false;
        return;
      }

      const key = e.key.toLowerCase();
      pressedKeys.delete(key);
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
      pressedKeys.clear();
    };
  }, [camera, requestRender, enabled, startLoop]);
}
