import { useStore } from "../store";
import { sseEvent } from "@/lib/schemas/sse-events";
import { useRef, useCallback } from "react";

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

  // Track abort controllers for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

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
        console.warn(`[processEvent] Ignoring event for stale session ${sessionId}, active is ${currentActiveSession}`);
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
            try {
              const structureRes = await fetch(
                `/api/sessions/${sessionId}/structure`
              );
              if (structureRes.ok) {
                const structureData = await structureRes.json();
                addStructureData(sessionId, structureData);
              }
            } catch (err) {
              console.error("Error fetching intermediate structure:", err);
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
              try {
                const structureRes = await fetch(
                  `/api/sessions/${sessionId}/structure`
                );
                if (structureRes.ok) {
                  const structureData = await structureRes.json();
                  addStructureData(sessionId, structureData);
                } else if (structureRes.status !== 404) {
                  console.error("Error fetching structure:", structureRes.statusText);
                }
              } catch (err) {
                console.error("Error fetching structure:", err);
              } finally {
                requestThumbnailCapture(sessionId);
              }
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
    async (sessionId: string, isResume: boolean = false, since: number = 0) => {
      console.log(`[subscribeToStream] Starting subscription`, { sessionId, isResume, since });

      // Cancel any existing subscription
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;


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
            if (line === "") {
              if (eventLines.length === 0) continue;
              const dataStr = eventLines.join("\n");
              eventLines = [];

              try {
                const rawData = JSON.parse(dataStr);
                const event = sseEvent.parse(rawData);
                console.log(`[subscribeToStream] Received event:`, event.type, event.data);
                const shouldContinue = await processEvent(
                  event,
                  sessionId,
                  sawCompleteTaskCallRef
                );
                if (!shouldContinue) {
                  console.log(`[subscribeToStream] Stream complete`);
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
      } catch (err: any) {
        if (err.name === "AbortError") {
          // Intentionally aborted, ignore
          return;
        }
        console.error("Stream error:", err);
        setAgentState("error");
      }
    },
    [processEvent, setAgentState]
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
      } catch (err: any) {
        console.error("Chat error:", err);
        setAgentState("error");
      }
    },
    [addUserMessage, subscribeToStream, setAgentState]
  );

  /**
   * Process buffered events from the status response.
   * Returns true if stream is complete, false if still running.
   */
  const processBufferedEvents = useCallback(
    async (sessionId: string, events: string[]): Promise<boolean> => {
      const sawCompleteTaskCallRef = { current: false };

      for (const eventStr of events) {
        try {
          // Events are pre-serialized SSE strings like "data: {...}\n\n"
          // Extract the JSON from the SSE format
          const match = eventStr.match(/^data:\s*(.+)$/m);
          if (!match) continue;

          const rawData = JSON.parse(match[1]);
          const event = sseEvent.parse(rawData);
          const shouldContinue = await processEvent(event, sessionId, sawCompleteTaskCallRef);

          if (!shouldContinue) {
            return true; // Stream complete
          }
        } catch (err) {
          console.error("[processBufferedEvents] Error parsing event:", err, eventStr);
        }
      }

      return false; // Not complete yet
    },
    [processEvent]
  );

  /**
   * Check session status and resume stream if task is running.
   *
   * IMPORTANT: The conversation is already loaded from the backend via restoreSession.
   * We should NOT replay buffered events as that would duplicate messages.
   * We only need to subscribe to the live stream if the task is still running.
   */
  const checkAndResumeSession = useCallback(
    async (sessionId: string) => {
      console.log(`[checkAndResumeSession] Checking status for session ${sessionId}`);
      try {
        const response = await fetch(`/api/sessions/${sessionId}/status`);
        if (!response.ok) return;

        // Check if session is still active after async fetch completes
        const currentActive = useStore.getState().activeSessionId;
        if (currentActive !== sessionId) {
          console.log(`[checkAndResumeSession] Session changed, aborting (current: ${currentActive})`);
          return;
        }

        const status = await response.json();
        console.log(`[checkAndResumeSession] Status response:`, {
          status: status.status,
          eventCount: status.event_count,
          error: status.error,
        });

        if (status.status === "running") {
          // Task is still running - subscribe to stream for new events
          // Start from current event count to avoid replaying already-persisted events
          console.log(`[checkAndResumeSession] Subscribing to stream with since=${status.event_count}`);
          setAgentState("thinking");
          await subscribeToStream(sessionId, true, status.event_count);
        } else {
          console.log(`[checkAndResumeSession] Task not running (${status.status}), no stream needed`);
        }
        // If status is "completed", "error", or "idle" - conversation is already loaded
        // from the backend, nothing to do here
      } catch (err) {
        console.error("Error checking session status:", err);
      }
    },
    [subscribeToStream, setAgentState]
  );

  /**
   * Cancel any active stream subscription.
   */
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    handleSend,
    subscribeToStream,
    checkAndResumeSession,
    cancelStream,
  };
}
