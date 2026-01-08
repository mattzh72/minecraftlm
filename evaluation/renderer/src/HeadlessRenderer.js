import { createCanvas, createImageData } from 'canvas';
import { ThreeStructureRenderer, BlockDefinition, BlockModel, TextureAtlas, Structure } from '@mattzh72/lodestone';
import { mat4, vec3 } from 'gl-matrix';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

// Try to import headless-gl with fallback - dynamic import to handle failures gracefully
let gl = null;

async function loadHeadlessGL() {
  try {
    const glModule = await import('gl');
    gl = glModule.default || glModule.gl;
    console.log('✅ headless-gl loaded successfully');
    return true;
  } catch (error) {
    console.warn('⚠️ headless-gl not available:', error.message);
    console.warn('⚠️ Falling back to canvas package WebGL (may have limitations)');
    return false;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Canvas wrapper that provides canvas-like interface for headless-gl context
 */
class HeadlessCanvasWrapper {
  constructor(width, height, glContext) {
    this.width = width;
    this.height = height;
    this.gl = glContext;

    // Canvas-like properties required by Three.js
    this.clientWidth = width;
    this.clientHeight = height;
    this.style = { width: `${width}px`, height: `${height}px` };

    // DOM method polyfills that Three.js expects
    this.addEventListener = () => {};
    this.removeEventListener = () => {};
    this.setPointerCapture = () => {};
    this.releasePointerCapture = () => {};
    this.focus = () => {};

    this.getBoundingClientRect = () => ({
      left: 0, top: 0, right: width, bottom: height,
      width: width, height: height, x: 0, y: 0
    });
  }

  getContext(type) {
    if (type === 'webgl' || type === 'experimental-webgl') {
      return this.gl;
    }
    return null;
  }

  async toBuffer(format = 'image/png') {
    // Extract pixel data from WebGL context
    const pixels = new Uint8Array(this.width * this.height * 4);
    this.gl.readPixels(0, 0, this.width, this.height,
                      this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);

    // Flip Y coordinate (WebGL uses bottom-left origin, PNG uses top-left)
    const flippedPixels = new Uint8Array(pixels.length);
    const stride = this.width * 4;
    for (let y = 0; y < this.height; y++) {
      const srcRow = (this.height - y - 1) * stride;
      const dstRow = y * stride;
      flippedPixels.set(pixels.subarray(srcRow, srcRow + stride), dstRow);
    }

    // Convert to PNG using Sharp
    return await sharp(flippedPixels, {
      raw: {
        width: this.width,
        height: this.height,
        channels: 4
      }
    }).png().toBuffer();
  }
}

/**
 * Headless Node.js renderer using Lodestone for Minecraft structure screenshots
 */
export class HeadlessRenderer {
  constructor(width = 1920, height = 1080, options = {}) {
    this.width = width;
    this.height = height;
    this.options = {
      timePreset: 'sunset',
      chunkSize: 16,
      drawDistance: 384,
      useInvisibleBlockBuffer: false,
      useHeadlessGL: true, // Try headless-gl first by default
      ...options
    };

    // Try to create WebGL context with fallback strategy
    this.glContext = null;
    this.canvas = null;
    this.renderMethod = null;
    this.initialized = false;

    this.addDOMPolyfills();
  }

  /**
   * Asynchronously initialize the renderer (required for dynamic imports)
   */
  async initialize() {
    if (this.initialized) return;

    // Try to load headless-gl dynamically
    await loadHeadlessGL();

    // Initialize WebGL context
    this.initializeWebGL(this.width, this.height);
    this.initialized = true;
  }

  /**
   * Initialize WebGL context with fallback strategy
   */
  initializeWebGL(width, height) {
    const errors = [];

    // Try headless-gl first if available and requested
    if (gl && this.options.useHeadlessGL !== false) {
      try {
        this.glContext = gl(width, height, {
          preserveDrawingBuffer: true,
          antialias: false,
          alpha: false,
          depth: true,
          stencil: false,
          premultipliedAlpha: false
        });

        if (this.glContext) {
          this.canvas = new HeadlessCanvasWrapper(width, height, this.glContext);
          this.renderMethod = 'headless-gl';
          console.log('✅ Using headless-gl for WebGL rendering (high performance mode)');
          return;
        }
      } catch (error) {
        errors.push(`headless-gl failed: ${error.message}`);
        console.warn('⚠️ headless-gl context creation failed:', error.message);
      }
    }

    // Fallback to canvas package WebGL
    try {
      console.log('🔄 Falling back to canvas package WebGL...');
      this.canvas = createCanvas(width, height, 'webgl');
      this.glContext = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');

      if (this.glContext) {
        this.renderMethod = 'canvas';
        console.log('✅ Using canvas package WebGL (fallback mode - may have limitations)');
        return;
      }
      throw new Error('Canvas package could not create WebGL context');
    } catch (error) {
      errors.push(`canvas WebGL failed: ${error.message}`);
    }

    // If both methods fail, throw comprehensive error
    throw new Error(`All WebGL methods failed: ${errors.join('; ')}`);
  }

  addDOMPolyfills() {
    // Add DOM polyfills for canvas package fallback (HeadlessCanvasWrapper handles its own)
    if (this.renderMethod === 'canvas') {
      this.canvas.addEventListener = () => {};
      this.canvas.removeEventListener = () => {};
      this.canvas.setPointerCapture = () => {};
      this.canvas.releasePointerCapture = () => {};
      this.canvas.focus = () => {};
      this.canvas.getBoundingClientRect = () => ({
        left: 0, top: 0, right: this.width, bottom: this.height,
        width: this.width, height: this.height, x: 0, y: 0
      });
      this.canvas.clientWidth = this.width;
      this.canvas.clientHeight = this.height;
    }
    // Store references for debugging
    this.gl = this.glContext;
    this.renderer = null;
    this.resources = null;
  }

  /**
   * Load Minecraft assets and create Lodestone resources
   */
  async loadAssets() {
    if (this.resources) {
      return this.resources; // Already loaded
    }

    console.log('🔄 Loading Minecraft assets...');

    // Load assets from the assets directory
    const assetsDir = path.resolve(__dirname, '../assets');

    // Load atlas image
    const atlasPath = path.join(assetsDir, 'atlas.png');
    const atlasBuffer = await fs.readFile(atlasPath);
    const atlasImage = await this.loadImageFromBuffer(atlasBuffer);

    // Load and parse assets.js
    const assetsPath = path.join(assetsDir, 'assets.js');
    const assetsCode = await fs.readFile(assetsPath, 'utf8');
    const assets = this.parseAssetsCode(assetsCode);

    // Load block flags
    const blockFlags = await this.loadBlockFlags(assetsDir);

    // Create Lodestone resources (adapted from frontend utils/lodestone.js)
    this.resources = this.createLodestoneResources(atlasImage, assets, blockFlags);

    console.log('✅ Assets loaded successfully');
    return this.resources;
  }

  /**
   * Load image from buffer (Node.js equivalent of browser Image)
   */
  async loadImageFromBuffer(buffer) {
    // Use canvas package to load the image
    const { loadImage } = await import('canvas');

    // Load the image from buffer
    const image = await loadImage(buffer);

    // Create a temporary canvas to extract ImageData
    const tempCanvas = createCanvas(image.width, image.height);
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(image, 0, 0);

    // Extract image data
    const imageData = tempCtx.getImageData(0, 0, image.width, image.height);

    return {
      width: image.width,
      height: image.height,
      data: imageData.data,
      imageData: imageData
    };
  }

  /**
   * Parse the assets.js file to extract blockstates, models, and textures
   */
  parseAssetsCode(assetsCode) {
    // The assets.js file declares: const assets = JSON.parse('...')
    // We wrap it in a function that returns the assets variable
    const wrappedCode = `(function() { ${assetsCode}; return assets; })()`;
    return eval(wrappedCode);
  }

  /**
   * Parse block list from text file (matches frontend parseBlockList)
   */
  parseBlockList(text) {
    const ids = new Set();
    // First, match any minecraft: prefixed IDs
    const matches = text.match(/minecraft:[a-z0-9_]+/g) ?? [];
    matches.forEach((match) => ids.add(match));

    // Also split on whitespace and add minecraft: prefix if needed
    text
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .forEach((token) => {
        const normalized = token.startsWith('minecraft:') ? token : `minecraft:${token}`;
        ids.add(normalized);
      });

    return ids;
  }

  /**
   * Load block flags from the block-flags directory (matches frontend useLodestoneResources.js)
   */
  async loadBlockFlags(assetsDir) {
    const flagsDir = path.join(assetsDir, 'block-flags');
    const blockFlags = {};

    try {
      // Load opaque blocks (using frontend parseBlockList approach)
      const opaquePath = path.join(flagsDir, 'opaque.txt');
      const opaqueData = await fs.readFile(opaquePath, 'utf8');
      blockFlags.opaque = this.parseBlockList(opaqueData);
      console.log(`📋 Loaded ${blockFlags.opaque.size} opaque blocks`);

      // Load transparent blocks
      const transparentPath = path.join(flagsDir, 'transparent.txt');
      const transparentData = await fs.readFile(transparentPath, 'utf8');
      blockFlags.transparent = this.parseBlockList(transparentData);
      console.log(`📋 Loaded ${blockFlags.transparent.size} transparent blocks`);

      // Load non-self-culling blocks (frontend loads this too)
      try {
        const nonSelfCullingPath = path.join(flagsDir, 'non_self_culling.txt');
        const nonSelfCullingData = await fs.readFile(nonSelfCullingPath, 'utf8');
        blockFlags.nonSelfCulling = this.parseBlockList(nonSelfCullingData);
        console.log(`📋 Loaded ${blockFlags.nonSelfCulling.size} non-self-culling blocks`);
      } catch (e) {
        blockFlags.nonSelfCulling = new Set();
      }

      // Load emissive blocks
      const emissivePath = path.join(flagsDir, 'emissive.json');
      const emissiveData = await fs.readFile(emissivePath, 'utf8');
      blockFlags.emissive = JSON.parse(emissiveData);
      console.log(`📋 Loaded ${Object.keys(blockFlags.emissive).length} emissive blocks`);

    } catch (error) {
      console.warn('⚠️ Could not load some block flags:', error.message);
      blockFlags.opaque = new Set();
      blockFlags.transparent = new Set();
      blockFlags.nonSelfCulling = new Set();
      blockFlags.emissive = {};
    }

    return blockFlags;
  }

  /**
   * Create Lodestone resources (adapted from frontend utils/lodestone.js)
   */
  createLodestoneResources(textureImage, assets, blockFlags = {}) {
    // Create block definitions
    const blockDefinitions = {};
    Object.keys(assets.blockstates || {}).forEach((id) => {
      blockDefinitions[`minecraft:${id}`] = BlockDefinition.fromJson(
        assets.blockstates[id]
      );
    });

    // Create block models
    const blockModels = {};
    Object.keys(assets.models || {}).forEach((id) => {
      blockModels[`minecraft:${id}`] = BlockModel.fromJson(
        assets.models[id]
      );
    });

    const normalizeId = this.normalizeId.bind(this);
    const blockModelAccessor = {
      getBlockModel(identifier) {
        const key = normalizeId(identifier);
        return blockModels[key] ?? null;
      },
    };

    // Flatten models
    Object.values(blockModels).forEach((m) => m.flatten(blockModelAccessor));

    // Create texture atlas using the loaded image
    // Ensure atlas dimensions are power of two (required by Lodestone)
    const atlasSize = this.upperPowerOfTwo(Math.max(textureImage.width, textureImage.height));

    const idMap = {};
    Object.keys(assets.textures || {}).forEach((id) => {
      const [u, v, du, dv] = assets.textures[id];
      const dv2 = du !== dv && id.startsWith('block/') ? du : dv;
      idMap[`minecraft:${id}`] = [
        u / atlasSize,
        v / atlasSize,
        (u + du) / atlasSize,
        (v + dv2) / atlasSize,
      ];
    });

    // Match frontend: create canvas at original size, then get atlasSize imageData (with padding)
    // Frontend code: atlasCanvas.width = textureImage.width; atlasCanvas.height = textureImage.height;
    // Then: atlasData = atlasCtx.getImageData(0, 0, atlasSize, atlasSize);
    const atlasCanvas = createCanvas(textureImage.width, textureImage.height);
    const atlasCtx = atlasCanvas.getContext('2d');
    atlasCtx.putImageData(textureImage.imageData, 0, 0);

    // Get atlasSize x atlasSize ImageData (will include padding beyond original image)
    const atlasData = atlasCtx.getImageData(0, 0, atlasSize, atlasSize);
    console.log(`📐 Atlas: original ${textureImage.width}x${textureImage.height}, padded to ${atlasSize}x${atlasSize}`);

    const textureAtlas = new TextureAtlas(atlasData, idMap);

    const opaqueBlocks = blockFlags.opaque ?? new Set();
    const transparentBlocks = blockFlags.transparent ?? new Set();
    const nonSelfCullingBlocks = blockFlags.nonSelfCulling ?? new Set();
    const emissiveBlocks = blockFlags.emissive ?? {};

    // Debug: Log some sample block flags
    console.log('🔍 Block flags sample check:');
    const sampleBlocks = ['minecraft:oak_planks', 'minecraft:water', 'minecraft:glass', 'minecraft:black_concrete'];
    sampleBlocks.forEach(block => {
      const inOpaque = opaqueBlocks.has(block);
      const inTransparent = transparentBlocks.has(block);
      console.log(`   - ${block}: opaque=${inOpaque}, transparent=${inTransparent}`);
    });

    return {
      getBlockDefinition: (id) => blockDefinitions[this.normalizeId(id)],
      getBlockModel: (id) => blockModels[this.normalizeId(id)],
      getTextureUV: (id) => textureAtlas.getTextureUV(id),
      getTextureAtlas: () => textureAtlas.getTextureAtlas(),
      getBlockFlags: (id) => {
        // Match frontend utils/lodestone.js getBlockFlags logic exactly
        const key = this.normalizeId(id);
        const isTransparent = transparentBlocks.has(key);
        const isExplicitOpaque = opaqueBlocks.has(key);
        // Frontend logic: opaque if explicitly listed OR (not transparent AND no opaque list exists)
        const isOpaque = !isTransparent && (isExplicitOpaque || opaqueBlocks.size === 0);
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
      getBlockProperties: () => null,
      getDefaultBlockProperties: () => null,
    };
  }

  /**
   * Calculate upper power of two (from frontend utils/lodestone.js)
   */
  upperPowerOfTwo(x) {
    x -= 1;
    x |= x >> 1;
    x |= x >> 2;
    x |= x >> 4;
    x |= x >> 8;
    x |= x >> 16;
    x |= x >> 32;
    return x + 1;
  }

  /**
   * Normalize block identifier
   */
  normalizeId(id) {
    if (!id) return '';
    if (typeof id === 'string') return id;
    if (typeof id.toString === 'function') return id.toString();
    return String(id);
  }

  /**
   * Create structure from JSON data (adapted from frontend utils/lodestone.js)
   */
  createStructureFromJson(structureData) {
    const { blocks, width, height, depth } = structureData;
    console.log(`🏗️ Creating structure: ${width}x${height}x${depth}, ${blocks.length} block definitions`);

    const structure = new Structure([width, height, depth]);

    // Use the frontend's approach: deduplicate blocks using a Map
    const blockMap = new Map();
    const generateKey = (x, y, z) => `${x},${y},${z}`;

    blocks.forEach((block, index) => {
      const { start, end, type, properties, fill } = block;
      const [startX, startY, startZ] = start;
      const [endX, endY, endZ] = end;

      if (index < 3) {
        console.log(`🧱 Block ${index}: ${type} at [${startX},${startY},${startZ}] to [${endX},${endY},${endZ}] fill:${fill}`);
      }

      for (let x = startX; x < endX; x++) {
        for (let y = startY; y < endY; y++) {
          for (let z = startZ; z < endZ; z++) {
            // Only place blocks on the shell unless fill is true
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

    // Place blocks from deduplicated map (frontend approach)
    let blockCount = 0;
    let errorCount = 0;
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
      } catch (error) {
        if (errorCount < 3) {
          console.log(`❌ Failed to place block ${value.type} at [${x},${y},${z}]:`, error.message);
          errorCount++;
        }
      }
    });

    console.log(`✅ Structure creation complete: ${blockCount} unique blocks placed`);
    console.log(`📊 Block types:`, Object.fromEntries(Array.from(typeCounts.entries()).slice(0, 5)));
    return structure;
  }

  /**
   * Get time preset configuration
   */
  getTimePreset(preset = 'sunset') {
    // Simple sunlight configuration that works with headless rendering
    const presets = {
      sunset: {
        direction: [-0.5, 0.25, 0.5],
        color: [1.0, 0.75, 0.45],
        ambientColor: [0.25, 0.4, 0.6],
        fillColor: [0.35, 0.28, 0.5],
        rimColor: [1.0, 0.55, 0.25],
        intensity: 1.0,
        ambientIntensity: 0.5,
        fillIntensity: 0.3,
        rimIntensity: 0.45,
        horizonFalloff: 0.7,
        exposure: 0.95,
      },
      day: {
        direction: [0.15, 0.95, 0.25],
        color: [1.0, 1.0, 0.9],
        ambientColor: [0.4, 0.5, 0.7],
        fillColor: [0.3, 0.35, 0.5],
        rimColor: [1.0, 0.9, 0.7],
        intensity: 1.2,
        ambientIntensity: 0.6,
        fillIntensity: 0.3,
        rimIntensity: 0.4,
        horizonFalloff: 0.8,
        exposure: 1.0,
      },
      night: {
        direction: [0.3, 0.8, 0.5],
        color: [0.2, 0.3, 0.6],
        ambientColor: [0.05, 0.08, 0.15],
        fillColor: [0.1, 0.12, 0.2],
        rimColor: [0.3, 0.4, 0.8],
        intensity: 0.3,
        ambientIntensity: 0.2,
        fillIntensity: 0.1,
        rimIntensity: 0.2,
        horizonFalloff: 0.5,
        exposure: 0.8,
      }
    };

    return presets[preset] || presets.sunset;
  }

  /**
   * Calculate camera view matrix for given structure bounds and angle
   * @param {Array} structureBounds - [minX, minY, minZ, maxX, maxY, maxZ]
   * @param {string|Object} angle - Preset name or custom {pitch, yaw, distance}
   */
  calculateCameraMatrix(structureBounds, angle = 'isometric') {
    const [minX, minY, minZ, maxX, maxY, maxZ] = structureBounds;

    const width = maxX - minX;
    const height = maxY - minY;
    const depth = maxZ - minZ;
    const maxDim = Math.max(width, height, depth);

    // Focus camera at center of structure
    let centerY = (minY + maxY) / 2;

    const center = vec3.fromValues(
      (minX + maxX) / 2,
      centerY,
      (minZ + maxZ) / 2
    );

    // Camera angle presets (match frontend distance multipliers)
    const angles = {
      isometric: { pitch: 0.3, yaw: 0.8, distance: 1.0 }, // Frontend default distance
      low: { pitch: 0.1, yaw: 0.4, distance: 1.0 },
      high: { pitch: 1.4, yaw: 0.8, distance: 1.0 }, // High angle to see from directly above
      side: { pitch: 0.0, yaw: 1.57, distance: 1.0 },
      overview: { pitch: 0.6, yaw: 0.8, distance: 1.2 }, // Slightly down from above midpoint
      dramatic: { pitch: 0.2, yaw: 1.3, distance: 1.1 }, // Low angle, rotated for dramatic effect
      hero: { pitch: 0.25, yaw: 0.5, distance: 1.0 }, // Low hero shot angle
    };

    // Support custom angle object or preset name
    const preset = typeof angle === 'object'
      ? { pitch: angle.pitch ?? 0.25, yaw: angle.yaw ?? 0.5, distance: angle.distance ?? 1.0 }
      : (angles[angle] || angles.isometric);

    // Auto-adjust for low angle shots
    const horizontalExtent = Math.max(width, depth);
    const heightRatio = height / horizontalExtent;

    // Low angle shots: shift look-at point DOWN so structure appears higher in frame (less sky)
    if (preset.pitch < 0.5) {
      center[1] -= height * 0.15; // Look lower to push structure up in frame
    }

    // Low angle shots need more distance to see the full structure
    let distanceMultiplier = 1.0;
    if (preset.pitch < 0.5) {
      distanceMultiplier = 1.2;
      if (heightRatio > 1.0) {
        distanceMultiplier = Math.min(1.4, 1.0 + heightRatio * 0.3);
      }
    }

    const distance = Math.max(5, maxDim * preset.distance * distanceMultiplier);

    console.log('🎯 Camera calculation:', {
      center: center,
      maxDim: maxDim,
      distance: distance,
      angle: angle,
      preset: preset
    });

    // Calculate camera position
    const eye = vec3.fromValues(
      center[0] + Math.cos(preset.yaw) * Math.cos(preset.pitch) * distance,
      center[1] + Math.sin(preset.pitch) * distance,
      center[2] + Math.sin(preset.yaw) * Math.cos(preset.pitch) * distance
    );

    console.log('📹 Camera position:', { eye: eye, center: center });

    const up = vec3.fromValues(0, 1, 0);
    const viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix, eye, center, up);

    return viewMatrix;
  }

  /**
   * Calculate structure bounds
   */
  calculateStructureBounds(structureData) {
    if (!structureData.blocks || structureData.blocks.length === 0) {
      return [0, 0, 0, 0, 0, 0];
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    structureData.blocks.forEach(block => {
      const [startX, startY, startZ] = block.start;
      const [endX, endY, endZ] = block.end;

      minX = Math.min(minX, startX, endX);
      minY = Math.min(minY, startY, endY);
      minZ = Math.min(minZ, startZ, endZ);
      maxX = Math.max(maxX, startX, endX);
      maxY = Math.max(maxY, startY, endY);
      maxZ = Math.max(maxZ, startZ, endZ);
    });

    return [minX, minY, minZ, maxX, maxY, maxZ];
  }

  /**
   * Generate screenshot from structure data
   * @param {Object} structureData - Structure data with blocks array
   * @param {Object} options - Render options (angle, etc.)
   */
  async generateScreenshot(structureData, options = {}) {
    await this.initialize();

    if (!structureData || !structureData.blocks) {
      throw new Error('Invalid structure data: must have blocks array');
    }

    console.log(`🏗️ Blocks: ${structureData.blocks?.length || 0}`);

    // Debug: Analyze structure composition
    if (structureData.blocks.length > 0) {
      console.log('\n🔍 STRUCTURE ANALYSIS:');

      // Calculate dimensions
      const bounds = this.calculateStructureBounds(structureData);
      const [minX, minY, minZ, maxX, maxY, maxZ] = bounds;
      console.log(`   📏 Structure bounds: (${minX}, ${minY}, ${minZ}) to (${maxX}, ${maxY}, ${maxZ})`);
        console.log(`   📐 Dimensions: ${maxX - minX + 1} x ${maxY - minY + 1} x ${maxZ - minZ + 1}`);

        // Analyze block types
        const blockTypes = {};
        const yLevels = {};
        let totalPlacedBlocks = 0;

        structureData.blocks.forEach(block => {
          const { start, end, type, fill } = block;
          const [startX, startY, startZ] = start;
          const [endX, endY, endZ] = end;

          // Calculate volume for this block definition
          const volume = (Math.abs(endX - startX) + 1) *
                        (Math.abs(endY - startY) + 1) *
                        (Math.abs(endZ - startZ) + 1);

          blockTypes[type] = (blockTypes[type] || 0) + volume;
          totalPlacedBlocks += volume;

          // Track Y-levels for block placement analysis
          const minBlockY = Math.min(startY, endY);
          const maxBlockY = Math.max(startY, endY);
          for (let y = minBlockY; y <= maxBlockY; y++) {
            yLevels[y] = (yLevels[y] || 0) + (Math.abs(endX - startX) + 1) * (Math.abs(endZ - startZ) + 1);
          }
        });

        console.log(`   🧱 Total placed blocks: ${totalPlacedBlocks.toLocaleString()}`);

        // Show top block types
        console.log(`   🎨 Top block types:`);
        Object.entries(blockTypes)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .forEach(([type, count]) => {
            const percentage = ((count / totalPlacedBlocks) * 100).toFixed(1);
            console.log(`     - ${type}: ${count.toLocaleString()} (${percentage}%)`);
          });

        // Show Y-level distribution (to understand if ship is underwater)
        console.log(`   📊 Y-level distribution (blocks per level):`);
        const sortedYLevels = Object.entries(yLevels)
          .map(([y, count]) => [parseInt(y), count])
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        sortedYLevels.forEach(([y, count]) => {
          const percentage = ((count / totalPlacedBlocks) * 100).toFixed(1);
          console.log(`     - Y=${y}: ${count.toLocaleString()} (${percentage}%)`);
        });

        // Find non-water blocks for ship analysis
        const nonWaterBlocks = Object.entries(blockTypes)
          .filter(([type, count]) => !type.includes('water') && !type.includes('sea'))
          .sort((a, b) => b[1] - a[1]);

        if (nonWaterBlocks.length > 0) {
          console.log(`   🚢 Non-water blocks (ship components):`);
          nonWaterBlocks.slice(0, 8).forEach(([type, count]) => {
            const percentage = ((count / totalPlacedBlocks) * 100).toFixed(1);
            console.log(`     - ${type}: ${count.toLocaleString()} (${percentage}%)`);
          });
        }

        console.log(''); // Add spacing
    }

    const buffer = await this.renderToPNG(structureData, options);
    return buffer;
  }

  /**
   * Render structure to PNG buffer
   */
  async renderToPNG(structureData, options = {}) {
    const {
      angle = 'isometric',
      timePreset = this.options.timePreset,
      outputPath = null
    } = options;

    console.log(`🎨 Rendering structure with ${angle} angle and ${timePreset} lighting...`);

    // Initialize renderer if not already done
    await this.initialize();

    // Load assets if not already loaded
    await this.loadAssets();

    // Create structure from JSON
    const structure = this.createStructureFromJson(structureData);
    console.log(`📦 Structure created: ${structure.getSize().join('x')} blocks`);

    // Create renderer with time preset
    const sunlightConfig = {
      ...this.getTimePreset(timePreset),
      ...this.options
    };

    this.renderer = new ThreeStructureRenderer(
      this.canvas,
      structure,
      this.resources,
      {
        chunkSize: this.options.chunkSize,
        drawDistance: this.options.drawDistance,
        useInvisibleBlockBuffer: this.options.useInvisibleBlockBuffer,
        sunlight: sunlightConfig,
      }
    );

    // Set viewport
    this.renderer.setViewport(0, 0, this.width, this.height);

    // Calculate camera matrix
    const bounds = this.calculateStructureBounds(structureData);
    console.log('🎥 Structure bounds:', bounds);
    console.log('📏 Structure dimensions:', {
      width: bounds[3] - bounds[0],
      height: bounds[4] - bounds[1],
      depth: bounds[5] - bounds[2]
    });
    const viewMatrix = this.calculateCameraMatrix(bounds, angle);

    // Add performance monitoring
    const renderStart = performance.now();

    // Wait for structure to fully load before rendering
    await new Promise(resolve => setTimeout(resolve, 100));

    // Render frame
    this.renderer.drawStructure(viewMatrix);

    // Convert canvas to PNG buffer (handle both HeadlessCanvasWrapper and canvas package)
    let buffer;
    if (this.renderMethod === 'headless-gl') {
      // HeadlessCanvasWrapper has async toBuffer method
      buffer = await this.canvas.toBuffer('image/png');
    } else {
      // Canvas package has sync toBuffer method
      buffer = this.canvas.toBuffer('image/png');
    }

    const renderTime = performance.now() - renderStart;

    // Log performance
    console.log(`⏱️ Render completed in ${Math.round(renderTime)}ms using ${this.renderMethod}`);
    if (renderTime < 80) {
      console.log('🚀 Target performance achieved (< 80ms)');
    } else if (renderTime < 150) {
      console.log('✅ Good performance (< 150ms)');
    } else {
      console.log('⚠️ Performance below target (> 150ms)');
    }

    // Save to file if path provided
    if (outputPath) {
      await fs.writeFile(outputPath, buffer);
      console.log(`✅ Screenshot saved: ${outputPath}`);
    }

    return buffer;
  }

  /**
   * Cleanup renderer resources
   */
  dispose() {
    if (this.renderer && this.renderer.dispose) {
      this.renderer.dispose();
    }
    this.renderer = null;
  }
}
