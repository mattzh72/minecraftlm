import { useStore } from "../store";
import { sseEvent } from "@/lib/schemas/sse-events";

export function useChat() {
  const addStructureData = useStore((s) => s.addStructureData);
  const addUserMessage = useStore((s) => s.addUserMessage);
  const setAgentState = useStore((s) => s.setAgentState);
  const addStreamDelta = useStore((s) => s.addStreamDelta);
  const addThoughtSummary = useStore((s) => s.addThoughtSummary);
  const addAssistantMessage = useStore((s) => s.addAssistantMessage);
  const addPreviewBlock = useStore((s) => s.addPreviewBlock);
  const clearPreviewBlocks = useStore((s) => s.clearPreviewBlocks);
  // const addToolCall = useStore((s) => s.addToolCall);
  const selectedModelId = useStore((s) => s.selectedModelId);

  const handleSend = async (userMessage: string, sessionId: string) => {
    if (!userMessage.trim() || !sessionId) return;

    addUserMessage(sessionId, userMessage);
    clearPreviewBlocks();

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
                  // addToolCall(sessionId, {
                  //   type: "function",
                  //   function: {
                  //     name: event.data.name,
                  //     arguments: JSON.stringify(event.data.args),
                  //   },
                  //   id: "TODO: make the backend give me this",
                  //   thought_signature: "",
                  //   extra_content: {},
                  // });
                  break;
                // case "tool_result":
                //   console.log(`TODO: HANDLE TOOL RESULT`, { event });

                //   break;
                case "text_delta":
                  setAgentState("streaming_text");
                  addStreamDelta(sessionId, event.data.delta);
                  break;
                case "block_preview":
                  console.log("block_preview received:", event.data.block);
                  if (event.data.block) {
                    addPreviewBlock({
                      start: event.data.block.start,
                      end: event.data.block.end,
                      type: event.data.block.type,
                      properties: event.data.block.properties || {},
                      fill: event.data.block.fill,
                      variable_name: event.data.block.variable_name,
                    });
                  }
                  break;
                case "complete":
                  setAgentState("idle");
                  if (event.data.success) {
                    try {
                      const structureRes = await fetch(
                        `/api/sessions/${sessionId}/structure`
                      );
                      if (structureRes.ok) {
                        const structureData = await structureRes.json();
                        addStructureData(sessionId, structureData);
                        clearPreviewBlocks(); // Clear preview blocks after structure is loaded
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
