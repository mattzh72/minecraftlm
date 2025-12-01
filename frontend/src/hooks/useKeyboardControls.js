import { useEffect, useRef } from 'react';
import { vec3 } from '../utils/deepslate';

// Movement distance per key press
const MOVE_DIST = 0.2;

// Key to movement direction mapping
const KEY_MOVES = {
  w: [0, 0, MOVE_DIST],
  s: [0, 0, -MOVE_DIST],
  a: [MOVE_DIST, 0, 0],
  d: [-MOVE_DIST, 0, 0],
  arrowup: [0, 0, MOVE_DIST],
  arrowdown: [0, 0, -MOVE_DIST],
  arrowleft: [MOVE_DIST, 0, 0],
  arrowright: [-MOVE_DIST, 0, 0],
  shift: [0, MOVE_DIST, 0],
  ' ': [0, -MOVE_DIST, 0],
};

/**
 * Hook to handle keyboard controls for camera movement
 * Handles WASD/arrow keys and vertical movement
 */
export default function useKeyboardControls(camera, render) {
  const pressedKeysRef = useRef(new Set());
  const animationFrameRef = useRef(null);

  useEffect(() => {
    if (!camera || !render) return;

    // Continuous movement update
    const updatePosition = () => {
      if (pressedKeysRef.current.size === 0) {
        animationFrameRef.current = null;
        return;
      }

      const direction = vec3.create();
      for (const key of pressedKeysRef.current) {
        if (KEY_MOVES[key]) {
          vec3.add(direction, direction, KEY_MOVES[key]);
        }
      }

      camera.move3d(direction, false);
      render();
      animationFrameRef.current = requestAnimationFrame(updatePosition);
    };

    const handleKeyDown = (evt) => {
      const key = evt.key.toLowerCase();
      if (KEY_MOVES[key] || evt.key === 'Shift') {
        evt.preventDefault();
        pressedKeysRef.current.add(key);
        if (!animationFrameRef.current) {
          animationFrameRef.current = requestAnimationFrame(updatePosition);
        }
      }
    };

    const handleKeyUp = (evt) => {
      const key = evt.key.toLowerCase();
      if (KEY_MOVES[key] || evt.key === 'Shift') {
        evt.preventDefault();
        pressedKeysRef.current.delete(key);
      }
    };

    // Add global keyboard listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      pressedKeysRef.current.clear();
    };
  }, [camera, render]);
}
