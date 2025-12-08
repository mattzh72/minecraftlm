import { useRef, useEffect } from 'react';
import { StructureRenderer } from 'deepslate';
import useDeepslateResources from '../hooks/useDeepslateResources';
import { structureFromJsonData, mat4, vec3 } from '../utils/deepslate';
import { Config } from '../config';

const { thumbnail: thumb, renderer: rend } = Config;

/**
 * Static thumbnail viewer for Minecraft structures
 * Renders a fixed-angle view without controls
 */
export default function ThumbnailViewer({ structureData, size = thumb.defaultSize }) {
  const canvasRef = useRef(null);
  const { resources, isLoading, error } = useDeepslateResources();

  useEffect(() => {
    if (!structureData || !resources || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    try {
      // Create structure from JSON data
      const structure = structureFromJsonData(structureData);

      // Create renderer
      const renderer = new StructureRenderer(
        gl,
        structure,
        resources,
        { chunkSize: rend.chunkSize }
      );

      // Set up camera with isometric view
      const view = mat4.create();

      // Calculate structure size
      const width = structureData.width || thumb.fallbackDimension;
      const height = structureData.height || thumb.fallbackDimension;
      const depth = structureData.depth || thumb.fallbackDimension;

      // Calculate viewing distance - scale with structure size
      const maxDim = Math.max(width, height, depth);
      const viewDist = maxDim * thumb.distanceMultiplier;

      // Center the structure
      const cameraPos = vec3.create();
      vec3.set(cameraPos, -width / 2, -height / 2, -depth / 2);

      // Apply transformations: first translate back, then rotate, then center structure
      mat4.translate(view, view, [0, 0, -viewDist]);
      mat4.rotateX(view, view, thumb.tiltAngle);
      mat4.rotateY(view, view, thumb.rotateAngle);
      mat4.translate(view, view, cameraPos);

      // Render once (static)
      renderer.drawStructure(view);
      renderer.drawGrid(view);
    } catch (err) {
      console.error('Error rendering thumbnail:', err);
    }
  }, [structureData, resources]);

  // Loading state
  if (isLoading) {
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
