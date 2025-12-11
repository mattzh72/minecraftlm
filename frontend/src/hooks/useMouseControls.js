import { useEffect, useRef } from 'react';
import { Config } from '../config';

/**
 * Hook to handle mouse controls for camera
 * Handles drag rotation and wheel zoom
 */
export default function useMouseControls(canvasRef, camera, requestRender) {
  const clickPosRef = useRef(null);
  const modeRef = useRef('rotate'); // 'rotate' or 'pan'

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !camera || !requestRender) return;

    const handleMouseDown = (evt) => {
      evt.preventDefault();
      clickPosRef.current = [evt.clientX, evt.clientY];
      modeRef.current = (evt.button === 2 || evt.shiftKey) ? 'pan' : 'rotate';
    };

    const handleMouseMove = (evt) => {
      if (clickPosRef.current) {
        const deltaX = evt.clientX - clickPosRef.current[0];
        const deltaY = evt.clientY - clickPosRef.current[1];
        if (modeRef.current === 'pan' && camera.panTarget) {
          camera.panTarget([deltaX, deltaY]);
        } else {
          camera.pan([deltaX, deltaY]);
        }
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
  }, [canvasRef, camera, requestRender]);
}
