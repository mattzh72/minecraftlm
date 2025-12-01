import { useRef, useCallback, useEffect } from 'react';
import { structureFromJsonData } from '../utils/deepslate';

/**
 * Hook to manage WebGL rendering loop
 * Creates renderer and provides render function
 */
export default function useRenderLoop(canvasRef, structureData, resources, camera) {
  const rendererRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Render function
  const render = useCallback(() => {
    if (!rendererRef.current || !camera) return;

    const view = camera.getViewMatrix();
    rendererRef.current.drawStructure(view);
    rendererRef.current.drawGrid(view);
  }, [camera]);

  // Request a render frame
  const requestRender = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(render);
  }, [render]);

  // Initialize renderer when structure/resources change
  useEffect(() => {
    if (!structureData || !resources || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    // Create structure from JSON data
    const structure = structureFromJsonData(structureData);

    // Clean up old animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Create new renderer
    const renderer = new window.deepslate.StructureRenderer(
      gl,
      structure,
      resources,
      { chunkSize: 8 }
    );
    rendererRef.current = renderer;

    // Initial render
    animationFrameRef.current = requestAnimationFrame(render);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [structureData, resources, canvasRef, render]);

  return {
    rendererRef,
    render,
    requestRender,
    animationFrameRef,
  };
}
