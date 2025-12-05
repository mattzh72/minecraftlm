import { useRef, useMemo, useEffect } from 'react';
import useSessionStore from '../store/sessionStore';
import useDeepslateResources from '../hooks/useDeepslateResources';
import useCamera from '../hooks/useCamera';
import useRenderLoop from '../hooks/useRenderLoop';
import useMouseControls from '../hooks/useMouseControls';
import useKeyboardControls from '../hooks/useKeyboardControls';

export default function MinecraftViewer() {
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
  useKeyboardControls(camera, render);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const { clientWidth, clientHeight } = canvas;
      if (clientWidth > 0 && clientHeight > 0) {
        canvas.width = clientWidth;
        canvas.height = clientHeight;
        requestRender();
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [canvasRef, requestRender]);

  // Loading state
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        color: '#666',
      }}>
        Loading resources...
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        color: '#EF5350',
      }}>
        Error: {error}
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
