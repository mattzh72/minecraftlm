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
          setAgentState("idle");
          if (event.data.success && sawCompleteTaskCallRef.current) {
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
          return false; // Stream complete

        case "error":
          console.error("Chat error:", event.data.message);
          setAgentState("error");
          return false; // Stream complete on error
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
    async (sessionId: string, isResume: boolean = false) => {
      // Cancel any existing subscription
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await fetch(`/api/sessions/${sessionId}/stream`, {
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
      const selectedModelId = useStore.getState().selectedModelId;
      console.log(`handleSend`, { userMessage, sessionId, selectedModelId });
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
   * Check session status and resume stream if task is running.
   * Call this when entering/switching to a session.
   */
  const checkAndResumeSession = useCallback(
    async (sessionId: string) => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/status`);
        if (!response.ok) return;

        const status = await response.json();

        if (status.status === "running") {
          // Task is still running, resume the stream
          setAgentState("thinking");
          await subscribeToStream(sessionId, true);
        } else if (status.has_events && status.status === "completed") {
          // Task completed while we were away, replay events to update UI
          await subscribeToStream(sessionId, true);
        }
        // If status is "idle" or "error" with no events, do nothing
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
