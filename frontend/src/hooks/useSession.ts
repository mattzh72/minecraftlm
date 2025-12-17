import { useCallback, useState } from "react";
import { useStore } from "../store";
import { createSessionResponseSchema } from "@/lib/schemas";
import { useChat } from "./use-chat";
import { sessionDetailsResponseSchema } from "@/lib/schemas";

export function useSession() {
  const setActiveSession = useStore((s) => s.setActiveSession);
  const setSelectedModelId = useStore((s) => s.setSelectedModelId);
  const { handleSend } = useChat();

  const [isLoading, setIsLoading] = useState(false);

  const createSession = useCallback(
    async (initialMessage?: string) => {
      console.log(`creating session`, {
        initialMessage,
        isLoading,
      });
      setIsLoading(true);
      try {
        console.log(`POSTing to create session`);
        const response = await fetch("/api/sessions", {
          method: "POST",
        });
        if (!response.ok) {
          throw new Error(`Failed to create session: ${response.status}`);
        }
        const responseData = await response.json();
        console.log(`responseData`, { responseData });
        const session = createSessionResponseSchema.parse(responseData);
        console.log(`setting active session`, { session });
        setActiveSession(session.session_id, {
          session_id: session.session_id,
        });

        if (initialMessage) {
          handleSend(initialMessage, session.session_id);
        }

        return session.session_id;
      } catch (error) {
        console.error("Error creating session:", error);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [setActiveSession]
  );

  const restoreSession = useCallback(
    async (sessionIdToRestore: string) => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/sessions/${sessionIdToRestore}`);
        if (!response.ok) {
          throw new Error(`Failed to restore session: ${response.status}`);
        }
        const data = await response.json();
        const session = sessionDetailsResponseSchema.parse(data);
        console.log(`restoring session`, { session });
        setActiveSession(session.session_id, {
          session_id: session.session_id,
          conversation: session.conversation,
          structure: session.structure,
        });
        // Restore the model that was used for this session
        if (session.model) {
          setSelectedModelId(session.model);
        }
      } catch (error) {
        console.error("Error restoring session:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [setActiveSession, setSelectedModelId]
  );
  const clearActiveSession = useCallback(() => {
    setActiveSession(null);
  }, [setActiveSession]);

  return {
    isLoading,
    createSession,
    restoreSession,
    clearActiveSession,
  };
}
