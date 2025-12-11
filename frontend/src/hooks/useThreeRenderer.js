import { useRef, useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';
import { getBlockColor } from '../utils/blockColors';
import { preloadTextures, getCachedTexture } from '../utils/textureLoader';

/**
 * Hook to manage Three.js rendering with InstancedMesh for efficient block rendering
 * Handles 100k+ blocks efficiently by batching same-type blocks
 */
export default function useThreeRenderer(canvasRef, structureData, camera, onSceneReady) {
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const meshesRef = useRef([]);
  const gridRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [texturesLoaded, setTexturesLoaded] = useState(false);

  // Render function
  const render = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !camera) return;

    // Update Three.js camera from our camera's view matrix
    const viewMatrix = camera.getViewMatrix();

    // gl-matrix produces column-major Float32Array, Three.js Matrix4.fromArray expects column-major
    // The view matrix transforms world coords to camera coords
    // To get the camera's world matrix, we invert the view matrix
    const viewMat = new THREE.Matrix4();
    viewMat.fromArray(viewMatrix);

    // Get camera world matrix by inverting view matrix
    const cameraMat = viewMat.clone().invert();

    // Disable auto-update so our manual matrix setting works
    cameraRef.current.matrixAutoUpdate = false;
    cameraRef.current.matrix.copy(cameraMat);
    cameraRef.current.matrixWorldNeedsUpdate = true;
    cameraRef.current.updateMatrixWorld(true);

    rendererRef.current.render(sceneRef.current, cameraRef.current);
  }, [camera]);

  // Request a render frame
  const requestRender = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(render);
  }, [render]);

  // Build scene from structure data
  const buildScene = useCallback((data) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    // Add strong ambient light so all faces are visible
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    // Add directional lights from multiple angles for even lighting
    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight1.position.set(50, 100, 50);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    dirLight2.position.set(-50, 50, -50);
    scene.add(dirLight2);

    // Group blocks by type for instanced rendering
    // Also compute actual bounding box
    const blocksByType = new Map();
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    data.blocks.forEach((block) => {
      const { start, end, type, fill } = block;
      const [startX, startY, startZ] = start;
      const [endX, endY, endZ] = end;

      // Expand block into individual voxels - render ALL blocks (no shell optimization)
      for (let x = startX; x < endX; x++) {
        for (let y = startY; y < endY; y++) {
          for (let z = startZ; z < endZ; z++) {
            if (!blocksByType.has(type)) {
              blocksByType.set(type, []);
            }
            blocksByType.get(type).push({ x, y, z });

            // Track bounding box
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            minZ = Math.min(minZ, z);
            maxX = Math.max(maxX, x + 1);
            maxY = Math.max(maxY, y + 1);
            maxZ = Math.max(maxZ, z + 1);
          }
        }
      }
    });

    // Compute center offset to center blocks at origin
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;

    // Block shape categories
    const FLAT_BLOCKS = new Set([
      'ladder', 'vine', 'glow_lichen', 'sculk_vein',
      'item_frame', 'glow_item_frame', 'painting',
    ]);
    const FLOOR_FLAT_BLOCKS = new Set([
      'rail', 'powered_rail', 'detector_rail', 'activator_rail',
      'carpet', 'moss_carpet', 'white_carpet', 'orange_carpet', 'magenta_carpet',
      'light_blue_carpet', 'yellow_carpet', 'lime_carpet', 'pink_carpet',
      'gray_carpet', 'light_gray_carpet', 'cyan_carpet', 'purple_carpet',
      'blue_carpet', 'brown_carpet', 'green_carpet', 'red_carpet', 'black_carpet',
      'snow', 'lily_pad',
    ]);
    const SLAB_BLOCKS = new Set([
      'stone_slab', 'cobblestone_slab', 'smooth_stone_slab',
      'oak_slab', 'spruce_slab', 'birch_slab', 'jungle_slab',
      'acacia_slab', 'dark_oak_slab', 'mangrove_slab', 'cherry_slab',
      'bamboo_slab', 'crimson_slab', 'warped_slab',
      'brick_slab', 'stone_brick_slab', 'sandstone_slab', 'red_sandstone_slab',
      'quartz_slab', 'purpur_slab', 'prismarine_slab', 'nether_brick_slab',
      'deepslate_slab', 'polished_deepslate_slab', 'cobbled_deepslate_slab',
      'blackstone_slab', 'polished_blackstone_slab',
    ]);
    const THIN_BLOCKS = new Set([
      'torch', 'wall_torch', 'soul_torch', 'soul_wall_torch',
      'redstone_torch', 'redstone_wall_torch',
      'lever', 'tripwire_hook',
    ]);
    const CROSS_BLOCKS = new Set([
      'grass', 'tall_grass', 'fern', 'large_fern',
      'dead_bush', 'seagrass', 'tall_seagrass',
      'dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet',
      'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip',
      'oxeye_daisy', 'cornflower', 'lily_of_the_valley', 'wither_rose',
      'sunflower', 'lilac', 'rose_bush', 'peony',
      'wheat', 'carrots', 'potatoes', 'beetroots',
      'sugar_cane', 'bamboo', 'cactus',
      'nether_wart', 'crimson_fungus', 'warped_fungus',
      'crimson_roots', 'warped_roots', 'nether_sprouts',
      'sweet_berry_bush', 'cave_vines',
      'sapling', 'oak_sapling', 'spruce_sapling', 'birch_sapling',
      'jungle_sapling', 'acacia_sapling', 'dark_oak_sapling',
      'cherry_sapling', 'mangrove_propagule',
    ]);
    const SKIP_BLOCKS = new Set([
      'air', 'cave_air', 'void_air', 'light', 'barrier',
      'structure_void', 'moving_piston',
    ]);

    // Helper to get block shape
    const getBlockShape = (blockType) => {
      const name = blockType.replace('minecraft:', '');
      if (SKIP_BLOCKS.has(name)) return 'skip';
      if (FLAT_BLOCKS.has(name)) return 'flat';
      if (FLOOR_FLAT_BLOCKS.has(name) || name.endsWith('_carpet')) return 'floor_flat';
      if (SLAB_BLOCKS.has(name) || name.endsWith('_slab')) return 'slab';
      if (THIN_BLOCKS.has(name)) return 'thin';
      if (CROSS_BLOCKS.has(name) || name.endsWith('_sapling')) return 'cross';
      return 'full';
    };

    // Create geometries for different shapes
    const geometries = {
      full: new THREE.BoxGeometry(1, 1, 1),
      slab: new THREE.BoxGeometry(1, 0.5, 1),
      flat: new THREE.PlaneGeometry(1, 1),
      floor_flat: new THREE.BoxGeometry(1, 0.0625, 1), // 1/16 height
      thin: new THREE.BoxGeometry(0.125, 0.625, 0.125),
      cross: new THREE.PlaneGeometry(1, 1), // Will be rendered as X shape
    };

    const meshes = [];

    blocksByType.forEach((positions, blockType) => {
      const shape = getBlockShape(blockType);

      // Skip invisible blocks
      if (shape === 'skip') return;

      // Try to use texture, fall back to color
      const texture = getCachedTexture(blockType);
      let material;

      // Check if this is a transparent block type
      const isTransparent = blockType.includes('glass') || blockType.includes('ice') ||
                           blockType.includes('leaves') || shape === 'cross' || shape === 'flat';

      if (texture) {
        material = new THREE.MeshLambertMaterial({
          map: texture,
          transparent: isTransparent,
          alphaTest: isTransparent ? 0.5 : 0,
          side: THREE.DoubleSide,
        });
      } else {
        const color = getBlockColor(blockType);
        material = new THREE.MeshLambertMaterial({
          color,
          transparent: isTransparent,
          opacity: isTransparent ? 0.7 : 1.0,
          side: THREE.DoubleSide,
        });
      }

      const geometry = geometries[shape] || geometries.full;

      const instancedMesh = new THREE.InstancedMesh(
        geometry,
        material,
        positions.length
      );

      const matrix = new THREE.Matrix4();
      positions.forEach((pos, i) => {
        matrix.identity();

        // Adjust Y offset based on shape
        let yOffset = 0.5;
        if (shape === 'slab') yOffset = 0.25;
        if (shape === 'floor_flat') yOffset = 0.03125;
        if (shape === 'thin') yOffset = 0.3125;

        // For flat blocks (ladders, vines), rotate to face outward
        if (shape === 'flat') {
          matrix.makeRotationY(0); // Would need block facing data for proper rotation
          matrix.setPosition(
            pos.x + 0.5 - centerX,
            pos.y + 0.5 - centerY,
            pos.z + 0.5 - centerZ
          );
        } else if (shape === 'cross') {
          // Cross shape needs two intersecting planes - skip for now, use single plane
          matrix.makeRotationY(Math.PI / 4);
          matrix.setPosition(
            pos.x + 0.5 - centerX,
            pos.y + 0.5 - centerY,
            pos.z + 0.5 - centerZ
          );
        } else {
          matrix.setPosition(
            pos.x + 0.5 - centerX,
            pos.y + yOffset - centerY,
            pos.z + 0.5 - centerZ
          );
        }

        instancedMesh.setMatrixAt(i, matrix);
      });

      instancedMesh.instanceMatrix.needsUpdate = true;
      scene.add(instancedMesh);
      meshes.push(instancedMesh);
    });

    // Add grid helper centered at origin
    const actualWidth = maxX - minX;
    const actualDepth = maxZ - minZ;
    const gridSize = Math.max(actualWidth, actualDepth);
    const grid = new THREE.GridHelper(gridSize, gridSize, 0x444444, 0x222222);
    grid.position.set(0, -centerY, 0); // Grid at y=0 relative to structure
    scene.add(grid);

    console.log(`Three.js scene built: ${blocksByType.size} block types, ${meshes.reduce((sum, m) => sum + m.count, 0)} total instances, bounds: (${minX},${minY},${minZ}) to (${maxX},${maxY},${maxZ})`);

    return { scene, meshes, grid };
  }, []);

  // Initialize/recreate renderer when structure changes
  useEffect(() => {
    if (!structureData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const hasValidDimensions = canvas.width > 0 && canvas.height > 0;
    if (!hasValidDimensions) return;

    let cancelled = false;

    // Async initialization with texture preloading
    const init = async () => {
      // Get unique block types for texture preloading
      const blockTypes = [...new Set(structureData.blocks.map(b => b.type))];

      // Preload textures (non-blocking, will fall back to colors if fails)
      await preloadTextures(blockTypes);

      if (cancelled) return;

      setTexturesLoaded(true);

      // Clean up old meshes
      meshesRef.current.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });
      meshesRef.current = [];

      // Create renderer
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
      });
      renderer.setSize(canvas.width, canvas.height, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      rendererRef.current = renderer;

      // Create perspective camera
      const aspect = canvas.width / canvas.height;
      const threeCamera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
      cameraRef.current = threeCamera;

      // Build scene (textures are now cached)
      const { scene, meshes, grid } = buildScene(structureData);
      sceneRef.current = scene;
      meshesRef.current = meshes;
      gridRef.current = grid;

      // Initial render
      animationFrameRef.current = requestAnimationFrame(render);

      // Notify that scene is ready (for camera sync)
      if (onSceneReady) {
        onSceneReady();
      }
    };

    init();

    // Cleanup
    return () => {
      cancelled = true;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Dispose meshes
      meshesRef.current.forEach((mesh) => {
        mesh.geometry.dispose();
        mesh.material.dispose();
      });

      // Dispose grid
      if (gridRef.current) {
        gridRef.current.geometry.dispose();
        gridRef.current.material.dispose();
      }

      // Dispose renderer
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }

      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      meshesRef.current = [];
      gridRef.current = null;
    };
  }, [structureData, buildScene, render]);

  // Resize handler
  const resize = useCallback(() => {
    if (!rendererRef.current || !canvasRef.current || !cameraRef.current) return;

    const { width, height } = canvasRef.current;
    rendererRef.current.setSize(width, height, false);
    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    render();
  }, [render]);

  return {
    rendererRef,
    sceneRef,
    meshesRef,
    render,
    requestRender,
    animationFrameRef,
    resize,
  };
}
