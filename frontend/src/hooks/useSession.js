import { useEffect, useRef } from 'react';
import useSessionStore from '../store/sessionStore';

/**
 * Hook to initialize session on mount
 * Checks URL for existing session, restores it or creates new one
 */
export default function useSession() {
  const sessionId = useSessionStore((state) => state.sessionId);
  const isLoading = useSessionStore((state) => state.isLoading);
  const initializeSession = useSessionStore((state) => state.initializeSession);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Only initialize session once on mount
    if (!initializedRef.current) {
      initializedRef.current = true;
      initializeSession();
    }
  }, [initializeSession]);

  return { sessionId, isLoading };
}
