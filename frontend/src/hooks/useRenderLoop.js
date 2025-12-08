import { useRef, useCallback, useEffect } from 'react';
import { StructureRenderer } from 'deepslate';
import { structureFromJsonData } from '../utils/deepslate';
import { Config } from '../config';

/**
 * Hook to manage WebGL rendering loop
 * Recreates renderer when canvas size changes to ensure correct projection
 */
export default function useRenderLoop(canvasRef, structureData, resources, camera) {
  const rendererRef = useRef(null);
  const glRef = useRef(null);
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

  // Initialize/recreate renderer when structure, resources, or canvas size changes
  useEffect(() => {
    if (!structureData || !resources || !canvasRef.current) return;

    const canvas = canvasRef.current;
    
    const hasValidDimensions = canvas.width > 0 && canvas.height > 0;
    if (!hasValidDimensions) return;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }
    glRef.current = gl;

    // Create structure from JSON data
    const structure = structureFromJsonData(structureData);

    // Clean up old animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Create new renderer
    const renderer = new StructureRenderer(
      gl,
      structure,
      resources,
      { chunkSize: Config.renderer.chunkSize }
    );
    rendererRef.current = renderer;

    // Set viewport and projection matrix to match canvas dimensions
    renderer.setViewport(0, 0, canvas.width, canvas.height);

    // Render
    animationFrameRef.current = requestAnimationFrame(render);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      rendererRef.current = null;
      glRef.current = null;
    };
  }, [structureData, resources, render]);


  // Resize viewport AND update projection matrix, then re-render
  const resize = useCallback(() => {
    if (!rendererRef.current || !canvasRef.current) return;
    const { width, height } = canvasRef.current;
    // setViewport updates both gl.viewport AND the internal projection matrix
    rendererRef.current.setViewport(0, 0, width, height);
    render();
  }, [render]);

  return {
    rendererRef,
    render,
    requestRender,
    animationFrameRef,
    resize,
  };
}
