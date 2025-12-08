import { useRef, useMemo } from "react";
import useSessionStore from "../store/sessionStore";
import useDeepslateResources from "../hooks/useDeepslateResources";
import useCamera from "../hooks/useCamera";
import useRenderLoop from "../hooks/useRenderLoop";
import useMouseControls from "../hooks/useMouseControls";
// import useKeyboardControls from '../hooks/useKeyboardControls';

export function MinecraftViewer() {
  const structureData = useSessionStore((state) => state.structureData);
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

  // Render loop
  const { render, requestRender } = useRenderLoop(
    canvasRef,
    structureData,
    resources,
    camera
  );

  // Mouse controls (drag to rotate, scroll to zoom)
  useMouseControls(canvasRef, camera, requestRender);

  // Keyboard controls (WASD/arrows to move)
  // useKeyboardControls(camera, render);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full text-gray-500">
        Loading resources...
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full text-red-500">
        Error: {error}
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={window.innerWidth}
      height={window.innerHeight}
      className="w-full h-full block"
    />
  );
}
