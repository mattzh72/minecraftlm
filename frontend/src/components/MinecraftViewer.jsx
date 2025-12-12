import { useRef, useMemo, useCallback, useLayoutEffect } from "react";
import { useStore } from "../store";
import useDeepslateResources from "../hooks/useDeepslateResources";
import useCamera from "../hooks/useCamera";
import useRenderLoop from "../hooks/useRenderLoop";
import useMouseControls from "../hooks/useMouseControls";
import useThumbnailCaptureOnComplete from "../hooks/useThumbnailCaptureOnComplete";

export function MinecraftViewer() {
  const activeSessionId = useStore((s) => s.activeSessionId);
  const sessions = useStore((s) => s.sessions);
  const thumbnailCaptureRequest = useStore((s) => s.thumbnailCaptureRequest);
  const clearThumbnailCaptureRequest = useStore(
    (s) => s.clearThumbnailCaptureRequest
  );
  const timeOfDay = useStore((s) => s.timeOfDay);
  const activeSession = useMemo(() => {
    return activeSessionId ? sessions[activeSessionId] : null;
  }, [activeSessionId, sessions]);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Capture current canvas and upload thumbnail to backend
  const captureAndUploadThumbnail = useCallback(async () => {
    if (!activeSessionId || !canvasRef.current) return;
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      await fetch(`/api/sessions/${activeSessionId}/thumbnail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
    } catch (err) {
      console.error('Error uploading thumbnail:', err);
    }
  }, [activeSessionId]);

  // Load rendering resources
  const { resources, isLoading, error } = useDeepslateResources();

  // Calculate structure size for camera initialization
  const structureSize = useMemo(() => {
    if (!activeSession?.structure) return null;
    return [activeSession.structure.width, activeSession.structure.height, activeSession.structure.depth];
  }, [activeSession]);

  // Camera controls
  const camera = useCamera(structureSize);

  // Render loop - recreate renderer when canvasSize changes
  const { requestRender, resize } = useRenderLoop(
    canvasRef,
    activeSession?.structure,
    resources,
    camera,
    timeOfDay
  );

  useThumbnailCaptureOnComplete({
    thumbnailCaptureRequest,
    activeSessionId,
    structureData: activeSession?.structure,
    isLoading,
    error,
    canvasRef,
    requestRender,
    captureAndUploadThumbnail,
    clearThumbnailCaptureRequest,
  });

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
          display: isLoading || error ? "none" : "block",
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
