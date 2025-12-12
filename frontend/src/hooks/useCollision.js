import { vec3 } from '../utils/deepslate';
import { Config } from '../config';

const { playable } = Config;

/**
 * Check if a block at the given position is solid
 */
export function isBlockSolid(structure, resources, x, y, z) {
  if (!structure || !resources) return false;

  const blockX = Math.floor(x);
  const blockY = Math.floor(y);
  const blockZ = Math.floor(z);

  const block = structure.getBlock([blockX, blockY, blockZ]);
  if (!block) return false;

  // Check block flags for opacity
  const blockName = block.state.getName();
  const flags = resources.getBlockFlags?.(blockName);

  // If we have flags, use opaque flag; otherwise assume solid if block exists
  if (flags) {
    return flags.opaque === true;
  }

  // Fallback: treat any non-air block as solid
  return blockName.toString() !== 'minecraft:air';
}

/**
 * Check if player AABB collides with any solid blocks
 * Position is eye level, we check from feet to head
 */
export function checkAABBCollision(structure, resources, position) {
  if (!structure || !resources) return false;

  const halfW = playable.playerWidth / 2;
  const halfD = playable.playerDepth / 2;
  const epsilon = 0.001; // avoid rounding down into the floor when grounded

  // Position is eye level, feet are playerHeight below
  const feetY = position[1] - playable.playerHeight + epsilon;
  const headY = position[1];

  const minX = Math.floor(position[0] - halfW);
  const maxX = Math.floor(position[0] + halfW);
  const minY = Math.floor(feetY);
  const maxY = Math.floor(headY);
  const minZ = Math.floor(position[2] - halfD);
  const maxZ = Math.floor(position[2] + halfD);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (isBlockSolid(structure, resources, x, y, z)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Check if player is standing on ground
 * Returns true if there's a solid block just below feet
 */
export function checkGrounded(structure, resources, position) {
  if (!structure || !resources) return false;

  const halfW = playable.playerWidth / 2;
  const halfD = playable.playerDepth / 2;

  // Check slightly below feet
  const feetY = position[1] - playable.playerHeight;
  const checkY = feetY - 0.01;

  // Check corners and center
  const checkPoints = [
    [position[0], checkY, position[2]],
    [position[0] - halfW + 0.01, checkY, position[2] - halfD + 0.01],
    [position[0] + halfW - 0.01, checkY, position[2] - halfD + 0.01],
    [position[0] - halfW + 0.01, checkY, position[2] + halfD - 0.01],
    [position[0] + halfW - 0.01, checkY, position[2] + halfD - 0.01],
  ];

  for (const [x, y, z] of checkPoints) {
    if (isBlockSolid(structure, resources, x, y, z)) {
      return true;
    }
  }

  return false;
}

/**
 * Attempt to move with collision detection
 * Uses axis-by-axis collision for sliding behavior
 * Returns the new valid position
 */
export function attemptMove(structure, resources, currentPos, delta) {
  if (!structure || !resources) {
    // No collision data, allow free movement
    const newPos = vec3.create();
    vec3.add(newPos, currentPos, delta);
    return newPos;
  }

  const newPos = vec3.clone(currentPos);

  // Try X movement
  const testX = vec3.clone(newPos);
  testX[0] += delta[0];
  if (!checkAABBCollision(structure, resources, testX)) {
    newPos[0] = testX[0];
  }

  // Try Z movement
  const testZ = vec3.clone(newPos);
  testZ[2] += delta[2];
  if (!checkAABBCollision(structure, resources, testZ)) {
    newPos[2] = testZ[2];
  }

  return newPos;
}

/**
 * Attempt vertical movement with collision
 * Returns { position, hitGround, hitCeiling }
 */
export function attemptVerticalMove(structure, resources, currentPos, deltaY) {
  if (!structure || !resources) {
    const newPos = vec3.clone(currentPos);
    newPos[1] += deltaY;
    return { position: newPos, hitGround: false, hitCeiling: false };
  }

  const newPos = vec3.clone(currentPos);
  newPos[1] += deltaY;

  if (checkAABBCollision(structure, resources, newPos)) {
    // Collision detected, find the valid position
    if (deltaY < 0) {
      // Moving down, snap to top of block
      const feetY = currentPos[1] - playable.playerHeight;
      const blockY = Math.floor(feetY + deltaY);
      newPos[1] = blockY + 1 + playable.playerHeight;
      return { position: newPos, hitGround: true, hitCeiling: false };
    } else {
      // Moving up, hit ceiling
      const headY = currentPos[1];
      const blockY = Math.floor(headY + deltaY);
      newPos[1] = blockY - 0.01;
      return { position: newPos, hitGround: false, hitCeiling: true };
    }
  }

  return { position: newPos, hitGround: false, hitCeiling: false };
}
