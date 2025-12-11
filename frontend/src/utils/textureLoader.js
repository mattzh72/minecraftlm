import * as THREE from 'three';

/**
 * Minecraft texture loader using PrismarineJS texture_content.json
 * Contains base64-encoded 16x16 textures
 */

const textureCache = new Map();
let textureData = null;
let loadingPromise = null;

const TEXTURE_JSON_URL = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.2/texture_content.json';

/**
 * Load the texture data JSON (cached)
 */
async function loadTextureData() {
  if (textureData) return textureData;
  if (loadingPromise) return loadingPromise;

  loadingPromise = fetch(TEXTURE_JSON_URL)
    .then(res => res.json())
    .then(data => {
      // Convert array to map for fast lookup
      textureData = new Map();
      for (const entry of data) {
        if (entry.texture) {
          textureData.set(entry.name, entry.texture);
        }
      }
      console.log(`Loaded ${textureData.size} textures from PrismarineJS`);
      return textureData;
    })
    .catch(err => {
      console.error('Failed to load texture data:', err);
      textureData = new Map();
      return textureData;
    });

  return loadingPromise;
}

/**
 * Get the texture name for a block type
 */
function getTextureName(blockType) {
  const blockName = blockType.replace('minecraft:', '');

  // Map block names to texture names (for blocks with multiple textures, use side)
  const textureNameMap = {
    'grass_block': 'grass_block_side',
    'oak_log': 'oak_log_side',
    'spruce_log': 'spruce_log_side',
    'birch_log': 'birch_log_side',
    'dark_oak_log': 'dark_oak_log_side',
    'jungle_log': 'jungle_log_side',
    'acacia_log': 'acacia_log_side',
    'mangrove_log': 'mangrove_log_side',
    'cherry_log': 'cherry_log_side',
    'pumpkin': 'pumpkin_side',
    'melon': 'melon_side',
    'furnace': 'furnace_front',
    'hay_block': 'hay_block_side',
  };

  return textureNameMap[blockName] || blockName;
}

/**
 * Create a Three.js texture from a data URI
 */
function createTextureFromDataURI(dataURI) {
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      dataURI,
      (texture) => {
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.colorSpace = THREE.SRGBColorSpace;
        resolve(texture);
      },
      undefined,
      () => resolve(null)
    );
  });
}

/**
 * Load a texture for a block type
 */
export async function loadBlockTexture(blockType) {
  const normalizedType = blockType.startsWith('minecraft:')
    ? blockType
    : `minecraft:${blockType}`;

  if (textureCache.has(normalizedType)) {
    return textureCache.get(normalizedType);
  }

  // Load texture data if not loaded
  const data = await loadTextureData();
  const textureName = getTextureName(normalizedType);
  const dataURI = data.get(textureName);

  if (!dataURI) {
    textureCache.set(normalizedType, null);
    return null;
  }

  const texture = await createTextureFromDataURI(dataURI);
  textureCache.set(normalizedType, texture);
  return texture;
}

/**
 * Preload textures for multiple block types
 */
export async function preloadTextures(blockTypes) {
  // First load the texture data JSON
  await loadTextureData();

  // Then load individual textures
  const uniqueTypes = [...new Set(blockTypes)];
  await Promise.all(uniqueTypes.map(type => loadBlockTexture(type)));
}

/**
 * Get texture from cache (sync, for use after preloading)
 */
export function getCachedTexture(blockType) {
  const normalizedType = blockType.startsWith('minecraft:')
    ? blockType
    : `minecraft:${blockType}`;
  return textureCache.get(normalizedType) ?? null;
}

/**
 * Clear all cached textures
 */
export function clearTextureCache() {
  textureCache.forEach((texture) => {
    if (texture) texture.dispose();
  });
  textureCache.clear();
}
