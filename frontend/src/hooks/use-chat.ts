import { useStore } from "../store";
import { sseEvent } from "@/lib/schemas/sse-events";
import { useCallback } from "react";

/**
 * Helper to fetch structure data for a session.
 * Centralized to avoid duplication.
 */
async function fetchStructure(sessionId: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`/api/sessions/${sessionId}/structure`);
    if (res.ok) {
      return await res.json();
    } else if (res.status !== 404) {
      console.error("Error fetching structure:", res.statusText);
    }
  } catch (err) {
    console.error("Error fetching structure:", err);
  }
  return null;
}

export function useChat() {
  const addStructureData = useStore((s) => s.addStructureData);
  const addUserMessage = useStore((s) => s.addUserMessage);
  const setAgentState = useStore((s) => s.setAgentState);
  const addStreamDelta = useStore((s) => s.addStreamDelta);
  const addThoughtSummary = useStore((s) => s.addThoughtSummary);
  const addAssistantMessage = useStore((s) => s.addAssistantMessage);
  const addToolCall = useStore((s) => s.addToolCall);
  const addToolResult = useStore((s) => s.addToolResult);
  const requestThumbnailCapture = useStore((s) => s.requestThumbnailCapture);

  // Stream management - shared across all useChat instances via store
  const setStreamAbortController = useStore((s) => s.setStreamAbortController);
  const abortCurrentStream = useStore((s) => s.abortCurrentStream);

  /**
   * Process a single SSE event and update store state.
   * Returns true if the stream should continue, false if complete.
   */
  const processEvent = useCallback(
    async (
      event: ReturnType<typeof sseEvent.parse>,
      sessionId: string,
      sawCompleteTaskCallRef: { current: boolean }
    ): Promise<boolean> => {
      // Validate this event is for the current active session
      // This prevents stale events from updating state after session switch
      const currentActiveSession = useStore.getState().activeSessionId;
      if (currentActiveSession !== sessionId) {
        return false; // Stop processing this stream
      }

      switch (event.type) {
        case "turn_start":
          setAgentState("thinking");
          addAssistantMessage(sessionId, "");
          return true;

        case "thought":
          addThoughtSummary(sessionId, event.data.delta);
          return true;

        case "tool_call":
          setAgentState("tool_calling");
          if (event.data.name === "complete_task") {
            sawCompleteTaskCallRef.current = true;
          }
          addToolCall(sessionId, {
            type: "function",
            function: {
              name: event.data.name,
              arguments: JSON.stringify(event.data.args),
            },
            id: event.data.id,
            thought_signature: "",
            extra_content: {},
          });
          return true;

        case "tool_result": {
          const hasError = !!event.data.error;
          const resultContent = JSON.stringify({
            result: event.data.result,
            error: event.data.error,
          });
          addToolResult(sessionId, event.data.tool_call_id, resultContent, hasError);

          // Check if this tool result includes a structure update
          if (event.data.compilation?.structure_updated) {
            const structureData = await fetchStructure(sessionId);
            if (structureData) {
              addStructureData(sessionId, structureData);
            }
          }
          return true;
        }

        case "text_delta":
          setAgentState("streaming_text");
          addStreamDelta(sessionId, event.data.delta);
          return true;

        case "complete":
          if (event.data.success) {
            setAgentState("idle");
            if (sawCompleteTaskCallRef.current) {
              const structureData = await fetchStructure(sessionId);
              if (structureData) {
                addStructureData(sessionId, structureData);
              }
              requestThumbnailCapture(sessionId);
            }
          } else {
            console.error("Chat error:", event.data.error);
            setAgentState("error");
          }
          return false; // Stream complete
      }
    },
    [
      setAgentState,
      addAssistantMessage,
      addThoughtSummary,
      addToolCall,
      addToolResult,
      addStreamDelta,
      addStructureData,
      requestThumbnailCapture,
    ]
  );

  /**
   * Subscribe to the SSE stream for a session.
   * Handles parsing and processing events until completion.
   */
  const subscribeToStream = useCallback(
    async (sessionId: string, since: number = 0) => {
      // Cancel any existing subscription (shared across all useChat instances)
      abortCurrentStream();

      const abortController = new AbortController();
      setStreamAbortController(abortController);

      try {
        const url = since > 0
          ? `/api/sessions/${sessionId}/stream?since=${since}`
          : `/api/sessions/${sessionId}/stream`;

        const response = await fetch(url, {
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Stream request failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let lineBuffer = "";
        let eventLines: string[] = [];
        const sawCompleteTaskCallRef = { current: false };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split(/\r?\n/);
          lineBuffer = lines.pop() || "";

          for (const line of lines) {
            // Early exit if aborted during processing
            if (abortController.signal.aborted) {
              return;
            }

            if (line === "") {
              if (eventLines.length === 0) continue;
              const dataStr = eventLines.join("\n");
              eventLines = [];

              try {
                const rawData = JSON.parse(dataStr);
                const event = sseEvent.parse(rawData);
                const shouldContinue = await processEvent(
                  event,
                  sessionId,
                  sawCompleteTaskCallRef
                );
                if (!shouldContinue) {
                  return; // Stream complete
                }
              } catch (parseErr) {
                console.error("Error parsing SSE data:", parseErr, dataStr);
              }
            } else if (line.startsWith("data:")) {
              eventLines.push(line.slice(5).trimStart());
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        console.error("[subscribeToStream] Stream error:", err);
        setAgentState("error");
      } finally {
        // Only clear if this is still our controller
        // (another stream might have started and set a new controller)
        const currentController = useStore.getState().streamAbortController;
        if (currentController === abortController) {
          setStreamAbortController(null);
        }
      }
    },
    [processEvent, setAgentState, abortCurrentStream, setStreamAbortController]
  );

  /**
   * Send a message and subscribe to the event stream.
   */
  const handleSend = useCallback(
    async (userMessage: string, sessionId: string) => {
      // Read selectedModelId and thinkingLevel at call time to avoid stale closure issues
      const selectedModelId = useStore.getState().selectedModelId;
      const selectedThinkingLevel = useStore.getState().selectedThinkingLevel;
      if (!userMessage.trim() || !sessionId) return;

      addUserMessage(sessionId, userMessage);

      try {
        // Start the task via POST
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            message: userMessage,
            model: selectedModelId,
            thinking_level: selectedThinkingLevel,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Chat request failed: ${response.status}`);
        }

        // Subscribe to the event stream
        await subscribeToStream(sessionId);
      } catch (err: unknown) {
        console.error("Chat error:", err);
        setAgentState("error");
      }
    },
    [addUserMessage, subscribeToStream, setAgentState]
  );

  /**
   * Resume stream if task is running.
   *
   * Called after restoreSession with the task status from the unified session response.
   * No separate API call needed - status info comes from GET /sessions/{id}.
   *
   * Buffer is cleared after each disk save, so on resume we replay ALL buffered events
   * (since=0) to rebuild the in-progress message. The frontend already knows how to
   * process these events, so we just stream them rather than trying to reconstruct.
   */
  const resumeStreamIfRunning = useCallback(
    async (sessionId: string, taskStatus: string) => {
      if (taskStatus === "running") {
        // Task is still running - subscribe to stream to replay ALL buffered events
        // Buffer only contains events since last disk save, so since=0 is correct
        setAgentState("thinking");
        await subscribeToStream(sessionId, 0);
      }
    },
    [subscribeToStream, setAgentState]
  );

  /**
   * Cancel any active stream subscription.
   */
  const cancelStream = useCallback(() => {
    abortCurrentStream();
  }, [abortCurrentStream]);

  return {
    handleSend,
    subscribeToStream,
    resumeStreamIfRunning,
    cancelStream,
  };
}
