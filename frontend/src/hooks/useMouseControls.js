import { useEffect, useRef } from 'react';
import { Config } from '../config';

/**
 * Hook to handle mouse controls for camera
 * Handles drag rotation and wheel zoom
 * @param {boolean} enabled - Whether mouse controls are active (default true)
 */
export default function useMouseControls(canvasRef, camera, requestRender, enabled = true) {
  const clickPosRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !camera || !requestRender || !enabled) return;

    const handleMouseDown = (evt) => {
      evt.preventDefault();
      clickPosRef.current = [evt.clientX, evt.clientY];
    };

    const handleMouseMove = (evt) => {
      if (clickPosRef.current) {
        const deltaX = evt.clientX - clickPosRef.current[0];
        const deltaY = evt.clientY - clickPosRef.current[1];
        // Always orbit around center
        camera.pan([deltaX, deltaY]);
        clickPosRef.current = [evt.clientX, evt.clientY];
        requestRender();
      }
    };

    const handleMouseUp = () => {
      clickPosRef.current = null;
    };

    const handleContext = (evt) => {
      evt.preventDefault();
    };

    const handleWheel = (evt) => {
      evt.preventDefault();
      // Use zoom instead of moving the camera position so we always
      // orbit around the structure center.
      const zoomDelta = evt.deltaY * Config.controls.zoomSensitivity;
      camera.zoom(zoomDelta);
      requestRender();
    };

    // Add event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseout', handleMouseUp);
    canvas.addEventListener('contextmenu', handleContext);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // Cleanup
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseout', handleMouseUp);
      canvas.removeEventListener('contextmenu', handleContext);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [canvasRef, camera, requestRender, enabled]);
}
