import { useRef, useCallback, useEffect } from 'react';
import { ThreeStructureRenderer } from '@mattzh72/lodestone';
import { structureFromJsonData } from '../utils/lodestone';
import { Config, TimePresets } from '../config';

/**
 * Hook to manage WebGL rendering loop
 * Recreates renderer when canvas size changes to ensure correct projection
 * @param {React.RefObject} canvasRef - Reference to the canvas element
 * @param {object} structureData - Structure data to render
 * @param {object} resources - Lodestone resources
 * @param {object} camera - Camera object
 * @param {string} timeOfDay - Time of day preset ('day', 'sunset', 'night')
 */
export default function useRenderLoop(canvasRef, structureData, resources, camera, timeOfDay = 'sunset') {
  const rendererRef = useRef(null);
  const animationFrameRef = useRef(null);
  const structureRef = useRef(null);
  const resourcesRef = useRef(null);
  const cameraRef = useRef(camera);

  // Keep camera ref updated
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  // Render function - uses ref to avoid recreating when camera changes
  const render = useCallback(() => {
    if (!rendererRef.current || !cameraRef.current) return;

    const view = cameraRef.current.getViewMatrix();
    rendererRef.current.drawStructure(view);
  }, []);

  // Request a render frame
  const requestRender = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(render);
  }, [render]);

  // Initialize/recreate renderer when structure, resources, or canvas size changes
  useEffect(() => {
    if (!structureData || !resources || !canvasRef.current) return;

    const canvas = canvasRef.current;

    const hasValidDimensions = canvas.width > 0 && canvas.height > 0;
    if (!hasValidDimensions) return;

    // Create structure from JSON data
    const structure = structureFromJsonData(structureData);
    structureRef.current = structure;
    resourcesRef.current = resources;
    console.log('[useRenderLoop] structure blocks', structureData.blocks?.length);

    // Clean up old animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Dispose previous renderer
    if (rendererRef.current && rendererRef.current.dispose) {
      rendererRef.current.dispose();
    }

    // Create new renderer
    const renderer = new ThreeStructureRenderer(
      canvas,
      structure,
      resources,
      {
        chunkSize: Config.renderer.chunkSize,
        drawDistance: Config.renderer.drawDistance,
        useInvisibleBlockBuffer: Config.renderer.useInvisibleBlockBuffer,
        sunlight: Config.renderer.sunlight,
      }
    );
    rendererRef.current = renderer;
    console.log('[useRenderLoop] created renderer', renderer);

    // Set viewport and projection matrix to match canvas dimensions
    renderer.setViewport(0, 0, canvas.width, canvas.height);

    // Render
    animationFrameRef.current = requestAnimationFrame(() => {
      render();
    });

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (rendererRef.current && rendererRef.current.dispose) {
        rendererRef.current.dispose();
      }
      rendererRef.current = null;
    };
  }, [structureData, resources, render, canvasRef]);

  // Update sunlight when timeOfDay changes
  useEffect(() => {
    if (!rendererRef.current || !timeOfDay) return;
    const preset = TimePresets[timeOfDay];
    if (preset) {
      rendererRef.current.setSunlight(preset);
      requestRender();
    }
  }, [timeOfDay, requestRender]);

  // Resize viewport AND update projection matrix, then re-render
  const resize = useCallback(() => {
    if (!rendererRef.current || !canvasRef.current) return;
    const { width, height } = canvasRef.current;
    // setViewport updates both gl.viewport AND the internal projection matrix
    rendererRef.current.setViewport(0, 0, width, height);
    render();
  }, [render, canvasRef]);

  return {
    rendererRef,
    structureRef,
    resourcesRef,
    render,          // Direct render (use when already in animation frame)
    requestRender,   // Scheduled render (use from event handlers)
    animationFrameRef,
    resize,
  };
}
