import { useRef, useMemo, useCallback, useLayoutEffect } from "react";
import { useStore } from "../store";
import useDeepslateResources from "../hooks/useDeepslateResources";
import useCamera from "../hooks/useCamera";
import useFirstPersonCamera from "../hooks/useFirstPersonCamera";
import useRenderLoop from "../hooks/useRenderLoop";
import useMouseControls from "../hooks/useMouseControls";
import useFirstPersonControls from "../hooks/useFirstPersonControls";
import usePhysics from "../hooks/usePhysics";
import useThumbnailCaptureOnComplete from "../hooks/useThumbnailCaptureOnComplete";

export function MinecraftViewer() {
  const activeSessionId = useStore((s) => s.activeSessionId);
  // Only subscribe to the structure data, not the entire session (avoids re-renders on conversation updates)
  const structureData = useStore((s) =>
    s.activeSessionId ? s.sessions[s.activeSessionId]?.structure : null
  );
  const thumbnailCaptureRequest = useStore((s) => s.thumbnailCaptureRequest);
  const clearThumbnailCaptureRequest = useStore(
    (s) => s.clearThumbnailCaptureRequest
  );
  const timeOfDay = useStore((s) => s.timeOfDay);
  const viewerMode = useStore((s) => s.viewerMode);
  const setViewerMode = useStore((s) => s.setViewerMode);

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
    if (!structureData) return null;
    return [structureData.width, structureData.height, structureData.depth];
  }, [structureData]);

  // Orbit camera (for orbit mode)
  const orbitCamera = useCamera(structureSize);

  // First-person camera (for playable mode)
  const fpCamera = useFirstPersonCamera(structureSize);

  // Use the appropriate camera based on mode
  const activeCamera = viewerMode === 'orbit' ? orbitCamera : fpCamera;

  // Render loop - recreate renderer when canvasSize changes
  const { render, requestRender, resize, structureRef, resourcesRef } = useRenderLoop(
    canvasRef,
    structureData,
    resources,
    activeCamera,
    timeOfDay
  );

  // Physics (only active in playable mode)
  // Pass render directly since physics runs in its own animation frame
  const physics = usePhysics(
    fpCamera.cameraState,
    structureRef,
    resourcesRef,
    viewerMode === 'playable',
    render
  );

  // Exit callback for when pointer lock is lost
  const exitPlayableMode = useCallback(() => {
    setViewerMode('orbit');
  }, [setViewerMode]);

  useThumbnailCaptureOnComplete({
    thumbnailCaptureRequest,
    activeSessionId,
    structureData,
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

  // Mouse controls (orbit mode only)
  useMouseControls(canvasRef, orbitCamera, requestRender, viewerMode === 'orbit');

  // First-person controls (playable mode only)
  useFirstPersonControls(
    canvasRef,
    fpCamera,
    physics,
    requestRender,
    viewerMode === 'playable',
    exitPlayableMode
  );

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
