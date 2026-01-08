import { useRef, useEffect } from 'react';
import { ThreeStructureRenderer } from '@mattzh72/lodestone';
import useLodestoneResources from '../hooks/useLodestoneResources';
import { structureFromJsonData, mat4, vec3 } from '../utils/lodestone';
import { Config } from '../config';

const { thumbnail: thumb, renderer: rend } = Config;

/**
 * Static thumbnail viewer for Minecraft structures
 * Renders a fixed-angle view without controls
 * @param {Object} structureData - The structure data to render
 * @param {number} size - Canvas size in pixels (default: 180)
 * @param {function} onRenderComplete - Callback with canvas data URL after render
 */
export default function ThumbnailViewer({ structureData, size = thumb.defaultSize, onRenderComplete }) {
  const canvasRef = useRef(null);
  const { resources, isLoading, error } = useLodestoneResources();

  useEffect(() => {
    if (!structureData || !resources || !canvasRef.current) return;

    const canvas = canvasRef.current;
    let renderer = null;

    try {
      // Create structure from JSON data
      const structure = structureFromJsonData(structureData);

      // Create renderer
      renderer = new ThreeStructureRenderer(
        canvas,
        structure,
        resources,
        {
          chunkSize: rend.chunkSize,
          drawDistance: rend.drawDistance,
          sunlight: rend.sunlight,
        }
      );
      renderer.setViewport(0, 0, canvas.width, canvas.height);

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
      console.log('[ThumbnailViewer] rendered thumbnail');

      // Capture canvas and call callback if provided
      if (onRenderComplete) {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          onRenderComplete(dataUrl);
        } catch (captureErr) {
          console.error('Error capturing thumbnail:', captureErr);
        }
      }
    } catch (err) {
      console.error('Error rendering thumbnail:', err);
    }

    return () => {
      if (renderer && renderer.dispose) {
        renderer.dispose();
      }
    };
  }, [structureData, resources, onRenderComplete]);

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
      className="w-full h-full object-cover rounded-lg block"
    />
  );
}
