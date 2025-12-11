import { useRef, useMemo, useCallback, useLayoutEffect, useState, useEffect } from "react";
import { useStore } from "../store";
import useCamera from "../hooks/useCamera";
import useThreeRenderer from "../hooks/useThreeRenderer";
import useMouseControls from "../hooks/useMouseControls";

export function MinecraftViewer() {
  const activeSessionId = useStore((s) => s.activeSessionId);
  const sessions = useStore((s) => s.sessions);
  const activeSession = useMemo(() => {
    return activeSessionId ? sessions[activeSessionId] : null;
  }, [activeSessionId, sessions]);

  const structureData = activeSession?.structure || null;

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  // Calculate structure size for camera initialization
  const structureSize = useMemo(() => {
    if (!structureData) return null;
    return [structureData.width, structureData.height, structureData.depth];
  }, [structureData]);

  // Camera controls
  const camera = useCamera(structureSize);

  // Track when we need to re-render after scene is ready
  const pendingRenderRef = useRef(false);

  // Callback when scene is ready - trigger re-render to sync camera
  const handleSceneReady = useCallback(() => {
    pendingRenderRef.current = true;
  }, []);

  // Three.js render loop - replaces deepslate
  const { requestRender, resize } = useThreeRenderer(
    canvasRef,
    structureData,
    camera,
    handleSceneReady
  );

  // Handle pending render after scene is ready
  useEffect(() => {
    if (pendingRenderRef.current && requestRender) {
      pendingRenderRef.current = false;
      // Small delay to ensure camera state is synchronized
      const timer = setTimeout(() => {
        requestRender();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [requestRender, structureData]);

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
    setIsReady(true);
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
          display: isReady ? "block" : "none",
        }}
      />

      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          Initializing renderer...
        </div>
      )}
    </div>
  );
}
