import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook to handle first-person controls: pointer lock, mouse look, WASD movement
 */
export default function useFirstPersonControls(
  canvasRef,
  camera,
  physics,
  requestRender,
  enabled,
  onExit
) {
  const pressedKeysRef = useRef(new Set());
  const isLockedRef = useRef(false);
  const lastWPressTimeRef = useRef(0);
  const isRunningRef = useRef(false);

  // Update movement intent based on pressed keys
  const updateMovementIntent = useCallback(() => {
    const keys = pressedKeysRef.current;
    let forward = 0;
    let right = 0;

    if (keys.has('w') || keys.has('arrowup')) forward += 1;
    if (keys.has('s') || keys.has('arrowdown')) forward -= 1;
    if (keys.has('a') || keys.has('arrowleft')) right -= 1;
    if (keys.has('d') || keys.has('arrowright')) right += 1;

    physics?.setMovementIntent(forward, right, isRunningRef.current);
  }, [physics]);

  // Request pointer lock
  const requestLock = useCallback(() => {
    const canvas = canvasRef?.current;
    if (canvas && enabled) {
      canvas.requestPointerLock?.();
    }
  }, [canvasRef, enabled]);

  useEffect(() => {
    if (!enabled) {
      // Release pointer lock when disabled
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
      pressedKeysRef.current.clear();
      physics?.setMovementIntent(0, 0, false);
      isLockedRef.current = false;
      isRunningRef.current = false;
      lastWPressTimeRef.current = 0;
      return;
    }

    const canvas = canvasRef?.current;
    if (!canvas) return;

    // Handle pointer lock change
    const handleLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      isLockedRef.current = locked;

      if (!locked && enabled) {
        // Pointer lock was lost, exit playable mode
        pressedKeysRef.current.clear();
        physics?.setMovementIntent(0, 0, false);
        isRunningRef.current = false;
        lastWPressTimeRef.current = 0;
        onExit?.();
      }
    };

    // Handle pointer lock error
    const handleLockError = () => {
      console.warn('Pointer lock failed');
      onExit?.();
    };

    // Mouse movement for looking
    const handleMouseMove = (e) => {
      if (!isLockedRef.current) return;

      const { movementX, movementY } = e;
      camera?.look(movementX, movementY);
      requestRender?.();
    };

    // Keyboard controls
    const handleKeyDown = (e) => {
      if (!isLockedRef.current) return;

      // Ignore if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      const key = e.key.toLowerCase();

      // Movement keys
      if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault();

        // Double-tap W detection for running
        const DOUBLE_TAP_WINDOW = 300; // milliseconds
        if (key === 'w' || key === 'arrowup') {
          const now = Date.now();
          if (now - lastWPressTimeRef.current < DOUBLE_TAP_WINDOW) {
            isRunningRef.current = true;
          }
          lastWPressTimeRef.current = now;
        }

        pressedKeysRef.current.add(key);
        updateMovementIntent();
      }

      // Jump
      if (key === ' ') {
        e.preventDefault();
        physics?.jump();
      }

      // ESC is handled by pointer lock API automatically
    };

    const handleKeyUp = (e) => {
      const key = e.key.toLowerCase();

      if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        // Stop running when W is released
        if (key === 'w' || key === 'arrowup') {
          isRunningRef.current = false;
        }

        pressedKeysRef.current.delete(key);
        updateMovementIntent();
      }
    };

    // Click to lock pointer
    const handleClick = () => {
      if (!isLockedRef.current) {
        requestLock();
      }
    };

    // Add event listeners
    document.addEventListener('pointerlockchange', handleLockChange);
    document.addEventListener('pointerlockerror', handleLockError);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('pointerlockchange', handleLockChange);
      document.removeEventListener('pointerlockerror', handleLockError);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('click', handleClick);

      // Clean up on unmount
      pressedKeysRef.current.clear();
    };
  }, [canvasRef, camera, physics, requestRender, enabled, onExit, updateMovementIntent, requestLock]);

  return {
    requestLock,
    isLocked: () => isLockedRef.current,
  };
}
