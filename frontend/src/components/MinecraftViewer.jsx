import { useRef, useMemo, useCallback, useState, useLayoutEffect } from "react";
import useSessionStore from "../store/sessionStore";
import useDeepslateResources from "../hooks/useDeepslateResources";
import useCamera from "../hooks/useCamera";
import useRenderLoop from "../hooks/useRenderLoop";
import useMouseControls from "../hooks/useMouseControls";

export function MinecraftViewer() {
  const structureData = useSessionStore((state) => state.structureData);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  

  // Load rendering resources
  const { resources, isLoading, error } = useDeepslateResources();

  // Calculate structure size for camera initialization
  const structureSize = useMemo(() => {
    if (!structureData) return null;
    return [structureData.width, structureData.height, structureData.depth];
  }, [structureData]);

  // Camera controls
  const camera = useCamera(structureSize);

  // Render loop - recreate renderer when canvasSize changes
  const { requestRender, resize } = useRenderLoop(
    canvasRef,
    structureData,
    resources,
    camera,
  );

  // Store resize in ref to avoid dependency issues
  const resizeRef = useRef(resize);
  resizeRef.current = resize;

  // Canvas sizing
  const updateCanvasSize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const { clientWidth, clientHeight } = container;
    if (clientWidth === 0 || clientHeight === 0) return;

    // Update canvas buffer dimensions
    canvas.width = clientWidth;
    canvas.height = clientHeight;
    
    // Update viewport and re-render
    resizeRef.current();
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    updateCanvasSize();

    const observer = new ResizeObserver(updateCanvasSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, [updateCanvasSize]);

  // Mouse controls
  useMouseControls(canvasRef, camera, requestRender);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{
          display: isLoading || error ? 'none' : 'block',
        }}
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          Loading resources...
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-500">
          Error: {error}
        </div>
      )}
    </div>
  );
}
