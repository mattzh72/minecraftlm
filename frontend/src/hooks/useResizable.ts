import { useCallback, useRef } from "react";

type UseResizableOptions = {
  width: number;
  minWidth: number;
  maxWidth: number;
  onWidthChange: (width: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
};

/**
 * Hook for handling horizontal resize interactions
 * Returns a mousedown handler to attach to a resize handle element
 */
export function useResizable({
  width,
  minWidth,
  maxWidth,
  onWidthChange,
  onResizeStart,
  onResizeEnd,
}: UseResizableOptions) {
  const isResizing = useRef(false);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizing.current = true;
      onResizeStart?.();

      const startX = e.clientX;
      const startWidth = width;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing.current) return;
        // Dragging left increases width (panel is on the right)
        const delta = startX - e.clientX;
        const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));
        onWidthChange(newWidth);
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        onResizeEnd?.();
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    },
    [width, minWidth, maxWidth, onWidthChange, onResizeStart, onResizeEnd]
  );

  return { handleResizeStart, isResizing };
}
