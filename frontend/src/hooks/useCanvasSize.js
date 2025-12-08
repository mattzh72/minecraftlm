import { useLayoutEffect, useRef, useCallback, useState } from 'react';

/**
 * Hook to handle canvas sizing imperatively (no React re-renders on resize)
 * Updates canvas dimensions directly and calls onResize callback
 * Returns isReady state to indicate when canvas has valid dimensions
 */
export default function useCanvasSize(containerRef, canvasRef, onResize) {
  const sizeRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  const updateSize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const { clientWidth, clientHeight } = container;
    if (clientWidth === 0 || clientHeight === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const bufferWidth = Math.floor(clientWidth * dpr);
    const bufferHeight = Math.floor(clientHeight * dpr);

    // Skip if dimensions haven't changed
    if (
      sizeRef.current &&
      sizeRef.current.bufferWidth === bufferWidth &&
      sizeRef.current.bufferHeight === bufferHeight
    ) {
      return;
    }

    // Update canvas dimensions imperatively (no React re-render)
    canvas.width = bufferWidth;
    canvas.height = bufferHeight;
    canvas.style.width = `${clientWidth}px`;
    canvas.style.height = `${clientHeight}px`;

    sizeRef.current = {
      cssWidth: clientWidth,
      cssHeight: clientHeight,
      bufferWidth,
      bufferHeight,
      dpr,
    };

    // Mark as ready on first valid sizing
    setIsReady(true);

    // Notify caller to update viewport and re-render
    onResize?.(sizeRef.current);
  }, [containerRef, canvasRef, onResize]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial sizing
    updateSize();

    // Observe resize
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);

    return () => observer.disconnect();
  }, [containerRef, updateSize]);

  return { sizeRef, isReady };
}
