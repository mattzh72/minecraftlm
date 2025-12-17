import { useCallback, useState } from "react";
import { useStore } from "../store";
import { createSessionResponseSchema } from "@/lib/schemas";
import { useChat } from "./use-chat";
import { sessionDetailsResponseSchema } from "@/lib/schemas";

export function useSession() {
  const setActiveSession = useStore((s) => s.setActiveSession);
  const setSelectedModelId = useStore((s) => s.setSelectedModelId);
  const { handleSend, resumeStreamIfRunning } = useChat();

  const [isLoading, setIsLoading] = useState(false);

  const createSession = useCallback(
    async (initialMessage?: string) => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/sessions", {
          method: "POST",
        });
        if (!response.ok) {
          throw new Error(`Failed to create session: ${response.status}`);
        }
        const responseData = await response.json();
        const session = createSessionResponseSchema.parse(responseData);
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
    [setActiveSession, handleSend]
  );

  const restoreSession = useCallback(
    async (sessionIdToRestore: string) => {
      setIsLoading(true);
      console.log(`[restoreSession] Starting restore for session ${sessionIdToRestore}`);
      try {
        const response = await fetch(`/api/sessions/${sessionIdToRestore}`);
        if (!response.ok) {
          throw new Error(`Failed to restore session: ${response.status}`);
        }
        const data = await response.json();
        console.log(`[restoreSession] GET /sessions/${sessionIdToRestore} response:`, {
          conversationLength: data.conversation?.length,
          conversation: data.conversation?.map((m: any) => ({
            role: m.role,
            contentLength: m.content?.length,
            thoughtLength: m.thought_summary?.length,
            toolCallsCount: m.tool_calls?.length,
          })),
        });
        const session = sessionDetailsResponseSchema.parse(data);
        setActiveSession(session.session_id, {
          session_id: session.session_id,
          conversation: session.conversation,
          structure: session.structure,
          has_thumbnail: session.has_thumbnail,
        });
        // Restore the model that was used for this session
        if (session.model) {
          setSelectedModelId(session.model);
        }

        // Resume stream if task is running (using status from the same response)
        // Frontend will subscribe with since=0 to replay all buffered events
        await resumeStreamIfRunning(session.session_id, session.task_status);
      } catch (error) {
        console.error("Error restoring session:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [setActiveSession, setSelectedModelId, resumeStreamIfRunning]
  );

  const clearActiveSession = useCallback(() => {
    // Cancel any active SSE stream before clearing the session
    // Call store action directly to avoid dependency on cancelStream which changes reference
    useStore.getState().abortCurrentStream();
    setActiveSession(null);
  }, [setActiveSession]);

  return {
    isLoading,
    createSession,
    restoreSession,
    clearActiveSession,
  };
}
