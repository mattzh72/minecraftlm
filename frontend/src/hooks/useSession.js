import { useEffect, useRef } from 'react';
import useSessionStore from '../store/sessionStore';

/**
 * Hook to initialize session on mount
 * Returns session state from the store
 */
export default function useSession() {
  const sessionId = useSessionStore((state) => state.sessionId);
  const isCreatingSession = useSessionStore((state) => state.isCreatingSession);
  const createSession = useSessionStore((state) => state.createSession);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Only create session once on mount
    if (!initializedRef.current) {
      initializedRef.current = true;
      createSession();
    }
  }, [createSession]);

  return { sessionId, isCreatingSession };
}
