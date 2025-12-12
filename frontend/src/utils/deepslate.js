// Deepslate utilities for Minecraft rendering
// Adapted from legacy implementation

import { BlockDefinition, BlockModel, TextureAtlas, Structure } from 'deepslate-opt';
import { mat4, vec3 } from 'gl-matrix';

let deepslateResources = null;

function upperPowerOfTwo(x) {
  x -= 1;
  x |= x >> 1;
  x |= x >> 2;
  x |= x >> 4;
  x |= x >> 8;
  x |= x >> 18;
  x |= x >> 32;
  return x + 1;
}

const normalizeId = (id) => {
  if (!id) return "";
  if (typeof id === "string") return id;
  if (typeof id.toString === "function") return id.toString();
  return String(id);
};

export function loadDeepslateResources(textureImage, assets, blockFlags = {}) {
  const blockDefinitions = {};
  Object.keys(assets.blockstates).forEach((id) => {
    blockDefinitions["minecraft:" + id] = BlockDefinition.fromJson(
      assets.blockstates[id]
    );
  });

  const blockModels = {};
  Object.keys(assets.models).forEach((id) => {
    blockModels["minecraft:" + id] = BlockModel.fromJson(
      assets.models[id]
    );
  });
  const blockModelAccessor = {
    getBlockModel(identifier) {
      const key = normalizeId(identifier);
      return blockModels[key] ?? null;
    },
  };
  Object.values(blockModels).forEach((m) => m.flatten(blockModelAccessor));

  const atlasCanvas = document.createElement("canvas");
  const atlasSize = upperPowerOfTwo(
    textureImage.width >= textureImage.height
      ? textureImage.width
      : textureImage.height
  );
  atlasCanvas.width = textureImage.width;
  atlasCanvas.height = textureImage.height;
  const atlasCtx = atlasCanvas.getContext("2d");
  atlasCtx.drawImage(textureImage, 0, 0);
  const atlasData = atlasCtx.getImageData(0, 0, atlasSize, atlasSize);
  const idMap = {};
  Object.keys(assets.textures).forEach((id) => {
    const [u, v, du, dv] = assets.textures[id];
    const dv2 = du !== dv && id.startsWith("block/") ? du : dv;
    idMap["minecraft:" + id] = [
      u / atlasSize,
      v / atlasSize,
      (u + du) / atlasSize,
      (v + dv2) / atlasSize,
    ];
  });

  const textureAtlas = new TextureAtlas(atlasData, idMap);

  const opaqueBlocks = blockFlags.opaque ?? new Set();
  const transparentBlocks = blockFlags.transparent ?? new Set();
  const nonOpaqueBlocks = blockFlags.nonOpaque ?? new Set();
  const nonSelfCullingBlocks = blockFlags.nonSelfCulling ?? new Set();
  const emissiveBlocks = blockFlags.emissive ?? {};

  deepslateResources = {
    getBlockDefinition(id) {
      return blockDefinitions[normalizeId(id)];
    },
    getBlockModel(id) {
      return blockModels[normalizeId(id)];
    },
    getTextureUV(id) {
      return textureAtlas.getTextureUV(id);
    },
    getTextureAtlas() {
      return textureAtlas.getTextureAtlas();
    },
    getBlockFlags(id) {
      const key = normalizeId(id);
      const isTransparent = transparentBlocks.has(key);
      const isExplicitOpaque = opaqueBlocks.has(key);
      const isExplicitNonOpaque = nonOpaqueBlocks.has(key);
      const isOpaque = !isTransparent && !isExplicitNonOpaque && (isExplicitOpaque || opaqueBlocks.size === 0);
      const isNonSelfCulling = nonSelfCullingBlocks.has(key);

      // Get emissive properties
      const emissiveData = emissiveBlocks[key];

      return {
        opaque: isOpaque,
        semi_transparent: isTransparent,
        self_culling: !isNonSelfCulling,
        emissive: !!emissiveData,
        emissiveIntensity: emissiveData?.intensity ?? 1.0,
        emissiveConditional: emissiveData?.conditional,
      };
    },
    getBlockProperties(id) {
      return null;
    },
    getDefaultBlockProperties(id) {
      return null;
    },
  };

  return deepslateResources;
}

export function getDeepslateResources() {
  return deepslateResources;
}

export function structureFromJsonData(data) {
  const blocks = data.blocks;
  const structure = new Structure([
    data.width,
    data.height,
    data.depth,
  ]);

  const blockMap = new Map();
  const generateKey = (x, y, z) => `${x},${y},${z}`;

  blocks.forEach((block) => {
    const { start, end, type, properties, fill } = block;
    const [startX, startY, startZ] = start;
    const [endX, endY, endZ] = end;

    for (let x = startX; x < endX; x++) {
      for (let y = startY; y < endY; y++) {
        for (let z = startZ; z < endZ; z++) {
          if (
            fill ||
            x === startX ||
            x === endX - 1 ||
            y === startY ||
            y === endY - 1 ||
            z === startZ ||
            z === endZ - 1
          ) {
            const key = generateKey(x, y, z);
            blockMap.set(key, { type, properties });
          }
        }
      }
    }
  });

  let blockCount = 0;
  const typeCounts = new Map();
  blockMap.forEach((value, key) => {
    const [x, y, z] = key.split(",").map(Number);
    try {
      if (value.properties) {
        structure.addBlock([x, y, z], value.type, value.properties);
      } else {
        structure.addBlock([x, y, z], value.type);
      }
      typeCounts.set(value.type, (typeCounts.get(value.type) ?? 0) + 1);
      blockCount++;
    } catch (err) {
      console.warn(
        `Unable to add block of type ${value.type} at position ${x}, ${y}, ${z}.`
      );
    }
  });

  console.log("Structure created:", blockCount, "blocks", Object.fromEntries(typeCounts.entries()));
  return structure;
}

export { mat4, vec3 };
