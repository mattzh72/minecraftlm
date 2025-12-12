import { useStore } from "../store";
import { sseEvent } from "@/lib/schemas/sse-events";

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

  const handleSend = async (userMessage: string, sessionId: string) => {
    // Read selectedModelId at call time to avoid stale closure issues
    const selectedModelId = useStore.getState().selectedModelId;
    console.log(`handleSend`, { userMessage, sessionId, selectedModelId });
    if (!userMessage.trim() || !sessionId) return;

    addUserMessage(sessionId, userMessage);
    console.log(`adding user message`, {
      sessionId,
      userMessage,
      selectedModelId,
    });

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: userMessage,
          model: selectedModelId,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Chat request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let lineBuffer = "";
      let eventLines: string[] = [];
      let sawCompleteTaskCall = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop() || "";
        console.log({ lines });

        for (const line of lines) {
          if (line === "") {
            if (eventLines.length === 0) continue;
            const dataStr = eventLines.join("\n");
            eventLines = [];

            try {
              const rawData = JSON.parse(dataStr);
              const result = sseEvent.parse(rawData);

              const event = result;

              switch (event.type) {
                case "turn_start":
                  setAgentState("thinking");
                  addAssistantMessage(sessionId, "");
                  break;
                case "thought":
                  addThoughtSummary(sessionId, event.data.delta);
                  break;
                case "tool_call":
                  setAgentState("tool_calling");
                  if (event.data.name === "complete_task") {
                    sawCompleteTaskCall = true;
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
                  break;
                case "tool_result": {
                  // Add tool result to conversation
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
                  break;
                }
                case "text_delta":
                  setAgentState("streaming_text");
                  addStreamDelta(sessionId, event.data.delta);
                  break;
                case "complete":
                  setAgentState("idle");
                  if (event.data.success && sawCompleteTaskCall) {
                    try {
                      const structureRes = await fetch(
                        `/api/sessions/${sessionId}/structure`
                      );
                      if (structureRes.ok) {
                        const structureData = await structureRes.json();
                        addStructureData(sessionId, structureData);
                      } else if (structureRes.status !== 404) {
                        // Only log errors for non-404 errors
                        console.error(
                          "Error fetching structure:",
                          structureRes.statusText
                        );
                      }
                      // If 404, simply do nothing (don't throw or log)
                    } catch (err) {
                      console.error("Error fetching structure:", err);
                    } finally {
                      requestThumbnailCapture(sessionId);
                    }
                  }
                  break;
                case "error":
                  console.error("Chat error:", event.data.message);
                  setAgentState("error");
                  break;
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
      console.error("Chat error:", err);
      if (err.name !== "AbortError") {
        console.error("Chat error:", err.message);
      }
    }
  };

  return {
    handleSend,
  };
}
