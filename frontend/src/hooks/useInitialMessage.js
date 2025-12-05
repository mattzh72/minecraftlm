import { useEffect, useRef } from 'react';

/**
 * Hook to handle sending an initial message from the homepage chat bar
 * when a new session is created
 */
export default function useInitialMessage(sessionId, messagesLength, isLoading, sendMessage) {
  const hasCheckedInitialMessage = useRef(false);

  useEffect(() => {
    if (!sessionId || isLoading || hasCheckedInitialMessage.current) return;

    const initialMessageKey = `initial_message_${sessionId}`;
    const initialMessage = sessionStorage.getItem(initialMessageKey);

    if (initialMessage && messagesLength === 0) {
      hasCheckedInitialMessage.current = true;

      // Clean up the stored message
      sessionStorage.removeItem(initialMessageKey);

      // Send the initial message
      sendMessage(initialMessage);
    }
  }, [sessionId, messagesLength, isLoading, sendMessage]);
}
