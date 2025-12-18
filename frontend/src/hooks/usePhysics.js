import { useRef, useEffect, useCallback } from 'react';
import { vec3 } from '../utils/deepslate';
import { Config } from '../config';
import { attemptMove, attemptVerticalMove, checkGrounded } from './useCollision';

const { playable } = Config;
const FIXED_DT = 1 / 60; // 60 Hz physics

/**
 * Hook to handle player physics: gravity, jumping, movement with collision
 */
export default function usePhysics(
  cameraState,
  structureRef,
  resourcesRef,
  enabled,
  render, // Direct render function (called from within animation frame)
  rendererRef // Renderer reference for setting FOV
) {
  const physicsState = useRef({
    velocity: vec3.fromValues(0, 0, 0),
    isGrounded: false,
    movementIntent: { forward: 0, right: 0 },
    isRunning: false,
  });

  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(null);
  const accumulatorRef = useRef(0);
  const prevRunningStateRef = useRef(false);

  const BASE_FOV = 70;
  const RUN_FOV = BASE_FOV * (playable.runFOVMultiplier ?? 1.15);

  // Set movement intent (called by controls)
  const setMovementIntent = useCallback((forward, right, isRunning = false) => {
    physicsState.current.movementIntent.forward = forward;
    physicsState.current.movementIntent.right = right;
    physicsState.current.isRunning = isRunning;

    // Update FOV when running state changes
    if (isRunning !== prevRunningStateRef.current && rendererRef?.current?.setFOV) {
      const targetFOV = isRunning ? RUN_FOV : BASE_FOV;
      rendererRef.current.setFOV(targetFOV);
      prevRunningStateRef.current = isRunning;
    }
  }, [rendererRef, RUN_FOV]);

  // Jump (called by controls)
  const jump = useCallback(() => {
    if (physicsState.current.isGrounded) {
      physicsState.current.velocity[1] = playable.jumpVelocity;
      physicsState.current.isGrounded = false;
    }
  }, []);

  // Check if grounded
  const isGrounded = useCallback(() => {
    return physicsState.current.isGrounded;
  }, []);

  // Physics update function (runs at fixed timestep)
  const updatePhysics = useCallback((dt) => {
    const structure = structureRef?.current;
    const resources = resourcesRef?.current;
    const position = cameraState.current.position;

    // 1. Apply gravity
    physicsState.current.velocity[1] += playable.gravity * dt;
    physicsState.current.velocity[1] = Math.max(
      physicsState.current.velocity[1],
      playable.terminalVelocity
    );

    // 2. Calculate horizontal movement from intent
    const { forward, right } = physicsState.current.movementIntent;
    const isRunning = physicsState.current.isRunning;
    const yaw = cameraState.current.yaw;

    // Apply run speed multiplier if running
    const speedMultiplier = isRunning ? (playable.runSpeedMultiplier ?? 1.6) : 1.0;
    const effectiveSpeed = playable.moveSpeed * speedMultiplier;

    // Forward/right directions based on yaw
    // Right is flipped to align with pointer lock look direction
    const moveX = (Math.sin(yaw) * forward - Math.cos(yaw) * right) * effectiveSpeed * dt;
    const moveZ = (Math.cos(yaw) * forward + Math.sin(yaw) * right) * effectiveSpeed * dt;

    const horizontalDelta = vec3.fromValues(moveX, 0, moveZ);

    // 3. Apply horizontal movement with collision
    const afterHorizontal = attemptMove(structure, resources, position, horizontalDelta, {
      isGrounded: physicsState.current.isGrounded,
    });

    // 4. Apply vertical movement with collision
    const verticalDelta = physicsState.current.velocity[1] * dt;
    const { position: newPos, hitGround, hitCeiling } = attemptVerticalMove(
      structure,
      resources,
      afterHorizontal,
      verticalDelta
    );

    // 5. Handle ground/ceiling collision
    if (hitGround) {
      physicsState.current.velocity[1] = 0;
      physicsState.current.isGrounded = true;
    } else if (hitCeiling) {
      physicsState.current.velocity[1] = 0;
    }

    // 6. Update grounded state
    if (!hitGround) {
      physicsState.current.isGrounded = checkGrounded(structure, resources, newPos);
      if (physicsState.current.isGrounded && physicsState.current.velocity[1] < 0) {
        physicsState.current.velocity[1] = 0;
      }
    }

    // 7. Update camera position
    vec3.copy(cameraState.current.position, newPos);

    // 8. Check for falling out of bounds - respawn if too low
    if (newPos[1] < -50) {
      // Respawn at default position
      const structure = structureRef?.current;
      if (structure) {
        const size = structure.getSize();
        cameraState.current.position = vec3.fromValues(
          size[0] / 2,
          size[1] + playable.spawnHeightOffset + playable.playerHeight,
          size[2] / 2
        );
      } else {
        cameraState.current.position = vec3.fromValues(0, 10, 0);
      }
      physicsState.current.velocity = vec3.fromValues(0, 0, 0);
    }
  }, [cameraState, structureRef, resourcesRef]);

  // Physics loop
  useEffect(() => {
    if (!enabled) {
      // Reset state when disabled
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastTimeRef.current = null;
      accumulatorRef.current = 0;
      physicsState.current.velocity = vec3.fromValues(0, 0, 0);
      physicsState.current.movementIntent = { forward: 0, right: 0 };
      physicsState.current.isRunning = false;
      prevRunningStateRef.current = false;

      // Reset FOV to base when exiting playable mode
      if (rendererRef?.current?.setFOV) {
        rendererRef.current.setFOV(BASE_FOV);
      }
      return;
    }

    const tick = (now) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
      }

      const delta = (now - lastTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // Accumulate time
      accumulatorRef.current += delta;

      // Fixed timestep physics updates
      while (accumulatorRef.current >= FIXED_DT) {
        updatePhysics(FIXED_DT);
        accumulatorRef.current -= FIXED_DT;
      }

      // Render directly (we're already in animation frame)
      render?.();

      // Continue loop
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [enabled, updatePhysics, render, rendererRef]);

  return {
    physicsState,
    setMovementIntent,
    jump,
    isGrounded,
  };
}
