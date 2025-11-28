// Three.js-flavored API for composing Minecraft schematics.
// Instead of a scene graph for meshes, we expose Object3D/Scene/Block
// primitives that mirror common Three.js patterns (position, add()) but emit
// the legacy viewer JSON: { width, height, depth, blocks: [ { start, end, type, properties, fill } ] }.

import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_ASSETS_PATH = path.join(__dirname, "static/js/assets.js");
const DEFAULT_OPAQUE_PATH = path.join(__dirname, "static/js/opaque.js");

function normalizeBlockId(blockId) {
  return blockId.startsWith("minecraft:") ? blockId : `minecraft:${blockId}`;
}

function parseAssetsFile(filePath) {
  if (!existsSync(filePath)) return {};
  const raw = readFileSync(filePath, "utf8");
  const marker = "JSON.parse(";
  const start = raw.indexOf(marker);
  if (start === -1) return {};

  const afterMarker = raw.slice(start + marker.length);
  const end = afterMarker.indexOf(");");
  if (end === -1) return {};

  let snippet = afterMarker.slice(0, end).trim();
  if (
    (snippet.startsWith("'") && snippet.endsWith("'")) ||
    (snippet.startsWith('"') && snippet.endsWith('"'))
  ) {
    snippet = snippet.slice(1, -1);
  }

  try {
    return JSON.parse(snippet);
  } catch (err) {
    return {};
  }
}

function parseOpaqueBlocks(filePath) {
  if (!existsSync(filePath)) return new Set();
  const raw = readFileSync(filePath, "utf8");
  const matches = raw.match(/"(minecraft:[a-z0-9_]+)"/g) || [];
  return new Set(matches.map((m) => m.slice(1, -1)));
}

export class BlockCatalog {
  constructor(options = {}) {
    const { assetsPath = DEFAULT_ASSETS_PATH, opaquePath = DEFAULT_OPAQUE_PATH } =
      options;
    this.assetsPath = assetsPath;
    this.opaquePath = opaquePath;
    this._assets = null;
    this._opaqueBlocks = null;
    this._blockIds = null;
  }

  get assets() {
    if (this._assets === null) {
      this._assets = parseAssetsFile(this.assetsPath);
    }
    return this._assets;
  }

  get blockIds() {
    if (this._blockIds === null) {
      const blockstates = this.assets?.blockstates || {};
      this._blockIds = new Set(
        Object.keys(blockstates).map((id) => `minecraft:${id}`)
      );
    }
    return this._blockIds;
  }

  get opaqueBlocks() {
    if (this._opaqueBlocks === null) {
      this._opaqueBlocks = parseOpaqueBlocks(this.opaquePath);
    }
    return this._opaqueBlocks;
  }

  assertValid(blockId) {
    const normalized = normalizeBlockId(blockId);
    if (this.blockIds.size > 0 && !this.blockIds.has(normalized)) {
      throw new Error(
        `Unknown block id "${blockId}". Expected one of ${this.blockIds.size} known blocks.`
      );
    }
    return normalized;
  }

  isOpaque(blockId) {
    return this.opaqueBlocks.has(normalizeBlockId(blockId));
  }
}

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  clone() {
    return new Vector3(this.x, this.y, this.z);
  }

  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  added(v) {
    return this.clone().add(v);
  }

  toArray() {
    return [this.x, this.y, this.z];
  }
}

export class Object3D {
  constructor() {
    this.position = new Vector3();
    this.children = [];
  }

  add(...objects) {
    this.children.push(...objects);
    return this;
  }
}

export class Block extends Object3D {
  constructor(blockId, options = {}) {
    super();
    const {
      size = [1, 1, 1],
      properties = {},
      fill = true,
      catalog = new BlockCatalog(),
    } = options;
    this.blockId = catalog.assertValid(blockId);
    this.properties = { ...properties };
    this.size = size;
    this.fill = fill;
  }

  setProperties(properties) {
    this.properties = { ...properties };
    return this;
  }

  mergeProperties(extra) {
    this.properties = { ...this.properties, ...extra };
    return this;
  }
}

export class Scene extends Object3D {
  constructor() {
    super();
  }

  /**
   * Flatten the scene graph into block placements with world positions.
   */
  flattenBlocks(parentOffset = new Vector3()) {
    const worldOffset = parentOffset.clone().add(this.position);
    const placements = [];

    for (const child of this.children) {
      if (child instanceof Block) {
        placements.push({
          block: child,
          position: worldOffset.added(child.position),
        });
      } else if (child instanceof Object3D) {
        placements.push(...child.flattenBlocks(worldOffset));
      }
    }

    return placements;
  }

  /**
   * Export to the legacy viewer JSON structure.
   *
   * origin: "min" (default) shifts scene so the smallest coordinate becomes 0.
   * padding: extra empty space around the structure.
   * dimensions: optional { width, height, depth } override.
   */
  toStructure({ origin = "min", padding = 0, dimensions } = {}) {
    const placements = this.flattenBlocks();
    if (placements.length === 0) {
      throw new Error("Scene has no blocks to export.");
    }

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    // Determine bounds based on start/end of each cuboid
    placements.forEach(({ block, position }) => {
      const [sx, sy, sz] = position.toArray();
      const [dx, dy, dz] = block.size;
      const ex = sx + dx;
      const ey = sy + dy;
      const ez = sz + dz;
      minX = Math.min(minX, sx);
      minY = Math.min(minY, sy);
      minZ = Math.min(minZ, sz);
      maxX = Math.max(maxX, ex);
      maxY = Math.max(maxY, ey);
      maxZ = Math.max(maxZ, ez);
    });

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const spanZ = maxZ - minZ;

    const offset =
      origin === "min"
        ? new Vector3(
            padding - minX,
            padding - minY,
            padding - minZ
          )
        : new Vector3(padding, padding, padding);

    const width = dimensions?.width ?? spanX + padding * 2;
    const height = dimensions?.height ?? spanY + padding * 2;
    const depth = dimensions?.depth ?? spanZ + padding * 2;

    const blocks = placements.map(({ block, position }) => {
      const start = position.added(offset).toArray();
      const end = [
        start[0] + block.size[0],
        start[1] + block.size[1],
        start[2] + block.size[2],
      ];
      return {
        start,
        end,
        type: block.blockId,
        properties:
          block.properties && Object.keys(block.properties).length
            ? block.properties
            : undefined,
        fill: block.fill,
      };
    });

    return {
      width,
      height,
      depth,
      blocks,
    };
  }
}

// --- Orientation helpers (block-state aware) ---

const CARDINALS = ["north", "east", "south", "west"];

/**
 * Compute the dominant horizontal facing from a vector (ignores Y).
 */
export function facingFromVector({ x, z }) {
  if (Math.abs(x) >= Math.abs(z)) {
    return x >= 0 ? "east" : "west";
  }
  return z >= 0 ? "south" : "north";
}

/**
 * Helper for stair block states: facing + half + shape (default straight).
 */
export function stairProperties({
  facing = "north",
  upsideDown = false,
  shape = "straight",
} = {}) {
  if (!CARDINALS.includes(facing)) {
    throw new Error(`Invalid stair facing "${facing}"`);
  }
  return {
    facing,
    half: upsideDown ? "top" : "bottom",
    shape,
  };
}

/**
 * Helper for logs/pillars: set axis based on orientation.
 */
export function axisProperties(axis = "y") {
  if (!["x", "y", "z"].includes(axis)) {
    throw new Error(`Invalid axis "${axis}"`);
  }
  return { axis };
}

/**
 * Helper for slabs: choose placement type.
 */
export function slabProperties({ top = false, double = false } = {}) {
  const type = double ? "double" : top ? "top" : "bottom";
  return { type };
}

/**
 * Quick factory for a single-block stair with orientation helpers.
 */
export function makeStair(blockId, options = {}) {
  const { direction = "north", upsideDown = false, catalog } = options;
  const props = stairProperties({ facing: direction, upsideDown });
  return new Block(blockId, { properties: props, catalog });
}
