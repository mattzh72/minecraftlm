import { vec3 } from '../utils/deepslate';
import { Config } from '../config';

const { playable } = Config;
const AIR_BLOCKS = new Set([
  'minecraft:air',
  'minecraft:cave_air',
  'minecraft:void_air',
]);
const ICE_BLOCKS = new Set([
  'minecraft:ice',
  'minecraft:packed_ice',
  'minecraft:blue_ice',
  'minecraft:frosted_ice',
]);

const isStairBlock = (blockName) => blockName?.endsWith('_stairs');
const isSlabBlock = (blockName) => blockName?.endsWith('_slab');

const getBlockCollisionHeight = (block) => {
  if (!block) return 1;
  const name = block.state.getName().toString();
  if (isSlabBlock(name)) {
    const type = block.state.getProperty?.('type');
    if (type === 'bottom') return 0.5;
    if (type === 'top') return 1; // top slab occupies upper half, so top is at full block height
    if (type === 'double') return 1;
    return 0.5;
  }
  return 1;
};

/**
 * Check if a block at the given position is solid
 */
export function isBlockSolid(structure, resources, x, y, z, blockOverride = null) {
  if (!structure || !resources) return false;

  const blockX = Math.floor(x);
  const blockY = Math.floor(y);
  const blockZ = Math.floor(z);

  const block = blockOverride ?? structure.getBlock([blockX, blockY, blockZ]);
  if (!block) return false;

  // Check block flags for opacity
  const blockName = block.state.getName().toString();
  const isFluid = typeof block.state.isFluid === 'function' ? block.state.isFluid() : false;

  // Ignore fluids and air-like blocks for collisions
  if (AIR_BLOCKS.has(blockName) || isFluid) {
    return false;
  }

  const flags = resources.getBlockFlags?.(blockName);

  if (flags) {
    // Treat transparent (but non-fluid) blocks like glass as solid for collisions
    if (flags.opaque === true || (flags.semi_transparent === true && !isFluid)) {
      return true;
    }
  }

  // Stairs (and similar) should be collidable even though they are non-opaque
  if (
    isStairBlock(blockName) ||
    isSlabBlock(blockName) ||
    blockName.endsWith('_leaves') ||
    blockName.endsWith('_fence') ||
    blockName.endsWith('_wall') ||
    ICE_BLOCKS.has(blockName)
  ) {
    return true;
  }

  return false;
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
 * Find the first solid block intersecting the player's AABB
 * Returns { block, position: [x, y, z] } or null
 */
function findFirstSolidCollision(structure, resources, position) {
  if (!structure || !resources) return null;

  const halfW = playable.playerWidth / 2;
  const halfD = playable.playerDepth / 2;
  const epsilon = 0.001;

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
        const block = structure.getBlock([x, y, z]);
        if (isBlockSolid(structure, resources, x, y, z, block)) {
          return { block, position: [x, y, z] };
        }
      }
    }
  }

  return null;
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
export function attemptMove(structure, resources, currentPos, delta, options = {}) {
  const { isGrounded = false } = options;
  if (!structure || !resources) {
    // No collision data, allow free movement
    const newPos = vec3.create();
    vec3.add(newPos, currentPos, delta);
    return newPos;
  }

  const newPos = vec3.clone(currentPos);

  const tryAxisMove = (axisIndex, deltaValue) => {
    if (deltaValue === 0) return;

    const testPos = vec3.clone(newPos);
    testPos[axisIndex] += deltaValue;
    const collision = findFirstSolidCollision(structure, resources, testPos);

    if (!collision) {
      newPos[axisIndex] = testPos[axisIndex];
      return;
    }

    // If we bumped into stairs or slabs while grounded, attempt to step up onto them
    const blockName = collision.block.state.getName().toString();
    if (isGrounded && (isStairBlock(blockName) || isSlabBlock(blockName))) {
      const targetFeetY = collision.position[1] + getBlockCollisionHeight(collision.block);
      const feetY = newPos[1] - playable.playerHeight;
      const climbHeight = targetFeetY - feetY;
      // Limit climb to a single stair height to avoid walking up walls
      if (climbHeight > 0 && climbHeight <= 1.05) {
        const steppedPos = vec3.clone(testPos);
        steppedPos[1] = newPos[1] + climbHeight;
        if (!checkAABBCollision(structure, resources, steppedPos)) {
          vec3.copy(newPos, steppedPos);
        }
      }
    }
  };

  // Try X then Z movement (with sliding)
  tryAxisMove(0, delta[0]);
  tryAxisMove(2, delta[2]);

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
      const collision = findFirstSolidCollision(structure, resources, newPos);
      const blockTop = collision
        ? collision.position[1] + getBlockCollisionHeight(collision.block)
        : Math.floor(currentPos[1] - playable.playerHeight + deltaY) + 1;
      newPos[1] = blockTop + playable.playerHeight;
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
