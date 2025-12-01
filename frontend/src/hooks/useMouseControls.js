import { useEffect, useRef } from 'react';

/**
 * Hook to handle mouse controls for camera
 * Handles drag rotation and wheel zoom
 */
export default function useMouseControls(canvasRef, camera, requestRender) {
  const clickPosRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !camera || !requestRender) return;

    const handleMouseDown = (evt) => {
      evt.preventDefault();
      clickPosRef.current = [evt.clientX, evt.clientY];
    };

    const handleMouseMove = (evt) => {
      if (clickPosRef.current) {
        const deltaX = evt.clientX - clickPosRef.current[0];
        const deltaY = evt.clientY - clickPosRef.current[1];
        camera.pan([deltaX, deltaY]);
        clickPosRef.current = [evt.clientX, evt.clientY];
        requestRender();
      }
    };

    const handleMouseUp = () => {
      clickPosRef.current = null;
    };

    const handleWheel = (evt) => {
      evt.preventDefault();
      camera.move3d([0, 0, -evt.deltaY / 200]);
      requestRender();
    };

    // Add event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseout', handleMouseUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // Cleanup
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseout', handleMouseUp);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [canvasRef, camera, requestRender]);
}
