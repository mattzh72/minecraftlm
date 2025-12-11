import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { getBlockColor } from '../utils/blockColors';
import { Config } from '../config';

const { thumbnail: thumb } = Config;

/**
 * Static thumbnail viewer for Minecraft structures using Three.js
 * Renders a fixed-angle view without controls
 * @param {Object} structureData - The structure data to render
 * @param {number} size - Canvas size in pixels (default: 180)
 * @param {function} onRenderComplete - Callback with canvas data URL after render
 */
export default function ThumbnailViewer({ structureData, size = thumb.defaultSize, onRenderComplete }) {
  const canvasRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!structureData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    setIsLoading(true);
    setError(null);

    try {
      // Create renderer
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        preserveDrawingBuffer: true, // Required for toDataURL
      });
      renderer.setSize(size, size, false);
      renderer.setClearColor(0x1a1a2e);

      // Create scene
      const scene = new THREE.Scene();

      // Add lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(50, 100, 50);
      scene.add(dirLight);

      // Group blocks by type
      const blocksByType = new Map();

      structureData.blocks.forEach((block) => {
        const { start, end, type, fill } = block;
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
                if (!blocksByType.has(type)) {
                  blocksByType.set(type, []);
                }
                blocksByType.get(type).push({ x, y, z });
              }
            }
          }
        }
      });

      // Create instanced meshes
      const geometry = new THREE.BoxGeometry(1, 1, 1);

      blocksByType.forEach((positions, blockType) => {
        const color = getBlockColor(blockType);
        const material = new THREE.MeshLambertMaterial({ color });

        const instancedMesh = new THREE.InstancedMesh(
          geometry,
          material,
          positions.length
        );

        const matrix = new THREE.Matrix4();
        positions.forEach((pos, i) => {
          matrix.setPosition(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5);
          instancedMesh.setMatrixAt(i, matrix);
        });

        instancedMesh.instanceMatrix.needsUpdate = true;
        scene.add(instancedMesh);
      });

      // Set up camera
      const width = structureData.width || thumb.fallbackDimension;
      const height = structureData.height || thumb.fallbackDimension;
      const depth = structureData.depth || thumb.fallbackDimension;

      const maxDim = Math.max(width, height, depth);
      const viewDist = maxDim * thumb.distanceMultiplier;

      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);

      // Position camera for isometric-ish view
      const centerX = width / 2;
      const centerY = height / 2;
      const centerZ = depth / 2;

      // Apply rotation angles from config
      const tiltAngle = thumb.tiltAngle;
      const rotateAngle = thumb.rotateAngle;

      camera.position.set(
        centerX + viewDist * Math.sin(rotateAngle) * Math.cos(tiltAngle),
        centerY + viewDist * Math.sin(tiltAngle),
        centerZ + viewDist * Math.cos(rotateAngle) * Math.cos(tiltAngle)
      );
      camera.lookAt(centerX, centerY, centerZ);

      // Render
      renderer.render(scene, camera);

      // Capture and callback
      if (onRenderComplete) {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          onRenderComplete(dataUrl);
        } catch (captureErr) {
          console.error('Error capturing thumbnail:', captureErr);
        }
      }

      setIsLoading(false);

      // Cleanup
      return () => {
        geometry.dispose();
        blocksByType.forEach((_, blockType) => {
          // Materials are disposed with the scene
        });
        renderer.dispose();
      };
    } catch (err) {
      console.error('Error rendering thumbnail:', err);
      setError(err.message);
      setIsLoading(false);
    }
  }, [structureData, size, onRenderComplete]);

  // Loading state
  if (isLoading && !structureData) {
    return (
      <div
        className="flex items-center justify-center bg-gray-100 rounded-lg text-gray-400 text-xs"
        style={{ width: size, height: size }}
      >
        Loading...
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className="flex items-center justify-center bg-gray-100 rounded-lg text-red-400 text-xs"
        style={{ width: size, height: size }}
      >
        Error
      </div>
    );
  }

  // No structure state
  if (!structureData) {
    return (
      <div
        className="flex items-center justify-center bg-gray-100 rounded-lg text-gray-400 text-xs"
        style={{ width: size, height: size }}
      >
        No structure
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded-lg block"
      style={{ width: size, height: size }}
    />
  );
}
