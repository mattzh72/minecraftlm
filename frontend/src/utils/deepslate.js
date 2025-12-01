// Deepslate utilities for Minecraft rendering
// Adapted from legacy implementation

let deepslateResources = null;
const { mat4, vec3 } = window.glMatrix;

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

export function loadDeepslateResources(textureImage, assets) {
  const blockDefinitions = {};
  Object.keys(assets.blockstates).forEach((id) => {
    blockDefinitions["minecraft:" + id] = window.deepslate.BlockDefinition.fromJson(
      id,
      assets.blockstates[id]
    );
  });

  const blockModels = {};
  Object.keys(assets.models).forEach((id) => {
    blockModels["minecraft:" + id] = window.deepslate.BlockModel.fromJson(
      id,
      assets.models[id]
    );
  });
  Object.values(blockModels).forEach((m) =>
    m.flatten({ getBlockModel: (id) => blockModels[id] })
  );

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

  const textureAtlas = new window.deepslate.TextureAtlas(atlasData, idMap);

  deepslateResources = {
    getBlockDefinition(id) {
      return blockDefinitions[id];
    },
    getBlockModel(id) {
      return blockModels[id];
    },
    getTextureUV(id) {
      return textureAtlas.getTextureUV(id);
    },
    getTextureAtlas() {
      return textureAtlas.getTextureAtlas();
    },
    getBlockFlags(id) {
      return { opaque: false };
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
  const structure = new window.deepslate.Structure([
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
  blockMap.forEach((value, key) => {
    const [x, y, z] = key.split(",").map(Number);
    try {
      if (value.properties) {
        structure.addBlock([x, y, z], value.type, value.properties);
      } else {
        structure.addBlock([x, y, z], value.type);
      }
      blockCount++;
    } catch (err) {
      console.warn(
        `Unable to add block of type ${value.type} at position ${x}, ${y}, ${z}.`
      );
    }
  });

  console.log("Structure created:", blockCount, "blocks");
  return structure;
}

export { mat4, vec3 };
