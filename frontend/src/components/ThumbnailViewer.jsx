import { useRef, useEffect } from 'react';
import useDeepslateResources from '../hooks/useDeepslateResources';
import { structureFromJsonData, mat4, vec3 } from '../utils/deepslate';

/**
 * Static thumbnail viewer for Minecraft structures
 * Renders a fixed-angle view without controls
 */
export default function ThumbnailViewer({ structureData, size = 200 }) {
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
      const renderer = new window.deepslate.StructureRenderer(
        gl,
        structure,
        resources,
        { chunkSize: 8 }
      );

      // Set up camera with isometric view
      const view = mat4.create();

      // Calculate structure size
      const width = structureData.width || 16;
      const height = structureData.height || 16;
      const depth = structureData.depth || 16;

      // Calculate viewing distance - scale with structure size
      const maxDim = Math.max(width, height, depth);
      const viewDist = maxDim * 1.5; // Closer to fill the thumbnail better

      // Center the structure
      const cameraPos = vec3.create();
      vec3.set(cameraPos, -width / 2, -height / 2, -depth / 2);

      // Apply transformations: first translate back, then rotate, then center structure
      mat4.translate(view, view, [0, 0, -viewDist]);
      mat4.rotateX(view, view, 0.6);  // Tilt for isometric
      mat4.rotateY(view, view, 0.8);  // Rotate for isometric
      mat4.translate(view, view, cameraPos);

      // Render once (static)
      renderer.drawStructure(view);
      renderer.drawGrid(view);
    } catch (err) {
      console.error('Error rendering thumbnail:', err);
    }
  }, [structureData, resources]);

  if (isLoading) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          color: '#999',
          fontSize: '12px',
        }}
      >
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          color: '#ef5350',
          fontSize: '12px',
        }}
      >
        Error
      </div>
    );
  }

  if (!structureData) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px',
          color: '#999',
          fontSize: '12px',
        }}
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
      style={{
        width: size,
        height: size,
        borderRadius: '8px',
        display: 'block',
      }}
    />
  );
}
