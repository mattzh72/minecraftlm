import { useRef, useMemo, useCallback, useLayoutEffect } from "react";
import { useStore } from "../store";
import useDeepslateResources from "../hooks/useDeepslateResources";
import useCamera from "../hooks/useCamera";
import useRenderLoop from "../hooks/useRenderLoop";
import useMouseControls from "../hooks/useMouseControls";

export function MinecraftViewer() {
  const activeSessionId = useStore((s) => s.activeSessionId);
  const sessions = useStore((s) => s.sessions);
  const previewBlocks = useStore((s) => s.previewBlocks);

  const activeSession = useMemo(() => {
    return activeSessionId ? sessions[activeSessionId] : null;
  }, [activeSessionId, sessions]);

  const structureData = activeSession?.structure || null;

  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Load rendering resources
  const { resources, isLoading, error } = useDeepslateResources();

  // Combine structureData with preview blocks for rendering
  const combinedStructureData = useMemo(() => {
    // If we have preview blocks but no structure data, create a minimal structure
    if (previewBlocks.length > 0 && !structureData) {
      // Calculate max positions from preview blocks
      // Structure dimensions must be >= max position to contain all blocks
      let maxX = 0, maxY = 0, maxZ = 0;

      previewBlocks.forEach(block => {
        maxX = Math.max(maxX, block.end[0]);
        maxY = Math.max(maxY, block.end[1]);
        maxZ = Math.max(maxZ, block.end[2]);
      });

      return {
        width: Math.max(1, maxX),
        height: Math.max(1, maxY),
        depth: Math.max(1, maxZ),
        blocks: previewBlocks,
      };
    }

    // If we have structure data, merge preview blocks with it
    if (structureData && previewBlocks.length > 0) {
      return {
        ...structureData,
        blocks: [...(structureData.blocks || []), ...previewBlocks],
      };
    }

    // Otherwise just return the structure data as-is
    return structureData;
  }, [structureData, previewBlocks]);

  // Calculate structure size for camera initialization
  const structureSize = useMemo(() => {
    if (!combinedStructureData) return null;
    return [combinedStructureData.width, combinedStructureData.height, combinedStructureData.depth];
  }, [combinedStructureData]);

  // Camera controls
  const camera = useCamera(structureSize);

  // Render loop - recreate renderer when canvasSize changes
  const { requestRender, resize } = useRenderLoop(
    canvasRef,
    combinedStructureData,
    resources,
    camera
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
