import { useEffect } from 'react';

/**
 * Hook to capture and upload a thumbnail after a successful complete_task.
 */
export default function useThumbnailCaptureOnComplete({
  thumbnailCaptureRequest,
  activeSessionId,
  structureData,
  isLoading,
  error,
  canvasRef,
  requestRender,
  captureAndUploadThumbnail,
  clearThumbnailCaptureRequest,
}) {
  useEffect(() => {
    if (!thumbnailCaptureRequest) return;
    if (
      !activeSessionId ||
      thumbnailCaptureRequest.sessionId !== activeSessionId
    ) {
      return;
    }
    if (!structureData || !canvasRef.current || isLoading || error) {
      return;
    }

    requestRender();

    const rafId = requestAnimationFrame(() => {
      captureAndUploadThumbnail().finally(() => {
        clearThumbnailCaptureRequest();
      });
    });

    return () => cancelAnimationFrame(rafId);
  }, [
    thumbnailCaptureRequest?.nonce,
    thumbnailCaptureRequest?.sessionId,
    activeSessionId,
    structureData,
    isLoading,
    error,
    requestRender,
    captureAndUploadThumbnail,
    clearThumbnailCaptureRequest,
    canvasRef,
  ]);
}
