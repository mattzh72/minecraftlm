import { useState, useRef, useEffect, useCallback } from "react";
import { cva } from "class-variance-authority";
import useSessionStore from "../store/sessionStore";
import useAutoScroll from "../hooks/useAutoScroll";
import useInitialMessage from "../hooks/useInitialMessage";
import { PromptBoxWrapper } from "./PromptBox";

// Message bubble variants
const messageBubble = cva("p-3 text-sm text-slate-700", {
  variants: {
    error: {
      true: "text-red-700",
    },
  },
});

// Activity type variants
const activityText = cva("text-sm", {
  variants: {
    type: {
      thought: "text-slate-600",
      tool_call: "text-amber-600",
      tool_result: "text-emerald-600",
      error: "text-red-600",
    },
  },
});

// Message role label
const roleLabel = cva("text-xs font-semibold uppercase tracking-wide mb-1.5", {
  variants: {
    role: {
      user: "text-slate-500",
      agent: "text-emerald-600",
    },
  },
});

// Header component
function ChatPanelHeader() {
  return (
    <div className="px-4 py-3 border-b border-slate-200/50">
      <h2 className="text-sm font-medium text-slate-700">Chat</h2>
    </div>
  );
}

export default function ChatPanel() {
  const sessionId = useSessionStore((state) => state.sessionId);
  const conversation = useSessionStore((state) => state.conversation);
  const setStructureData = useSessionStore((state) => state.setStructureData);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const activitiesRef = useRef([]);
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Restore messages from conversation when session is loaded
  useEffect(() => {
    if (conversation && conversation.length > 0) {
      const restoredMessages = [];
      let currentAgentMessage = null;

      for (const msg of conversation) {
        if (msg.role === "user") {
          if (
            currentAgentMessage &&
            currentAgentMessage.activities.length > 0
          ) {
            restoredMessages.push(currentAgentMessage);
            currentAgentMessage = null;
          }
          restoredMessages.push({ role: "user", content: msg.content });
        } else if (msg.role === "assistant") {
          if (!currentAgentMessage) {
            currentAgentMessage = { role: "agent", activities: [] };
          }
          if (msg.content && msg.content.trim()) {
            currentAgentMessage.activities.push({
              type: "thought",
              content: msg.content,
            });
          }
          if (msg.tool_calls) {
            for (const toolCall of msg.tool_calls) {
              const args = JSON.parse(toolCall.function.arguments);
              currentAgentMessage.activities.push({
                type: "tool_call",
                name: toolCall.function.name,
                args: args,
              });
            }
          }
        } else if (msg.role === "tool") {
          if (!currentAgentMessage) {
            currentAgentMessage = { role: "agent", activities: [] };
          }
          const result = JSON.parse(msg.content);
          currentAgentMessage.activities.push({
            type: "tool_result",
            result: result,
          });
        }
      }

      if (currentAgentMessage && currentAgentMessage.activities.length > 0) {
        restoredMessages.push(currentAgentMessage);
      }

      setMessages(restoredMessages);
    }
  }, [conversation]);

  const messagesEndRef = useAutoScroll([messages]);

  const handleSend = useCallback(
    async (messageText = null) => {
      const userMessage = typeof messageText === "string" ? messageText : input;

      if (!userMessage.trim() || !sessionId || isLoading) return;

      setInput("");

      const newMessages = [
        ...messages,
        { role: "user", content: userMessage },
        { role: "agent", activities: [] },
      ];
      setMessages(newMessages);
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setIsLoading(true);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      activitiesRef.current = [];
      const agentMessageIndex = newMessages.length - 1;

      const syncActivities = () => {
        setMessages((prev) => {
          const updated = [...prev];
          if (updated[agentMessageIndex]?.role === "agent") {
            updated[agentMessageIndex] = {
              ...updated[agentMessageIndex],
              activities: [...activitiesRef.current],
            };
          }
          return updated;
        });
      };

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, message: userMessage }),
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Chat request failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          let hasNewActivity = false;

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                let activity = null;

                if (data.type === "text_delta") {
                  const lastActivity =
                    activitiesRef.current[activitiesRef.current.length - 1];
                  if (lastActivity && lastActivity.type === "thought") {
                    lastActivity.content += data.data.delta;
                  } else {
                    activitiesRef.current.push({
                      type: "thought",
                      content: data.data.delta,
                    });
                  }
                  hasNewActivity = true;
                } else if (data.type === "thought") {
                  activity = { type: "thought", content: data.data.text };
                } else if (data.type === "tool_call") {
                  activity = {
                    type: "tool_call",
                    name: data.data.name,
                    args: data.data.args,
                  };
                } else if (data.type === "tool_result") {
                  activity = { type: "tool_result", result: data.data };
                } else if (data.type === "complete") {
                  activity = {
                    type: "complete",
                    success: data.data.success,
                    message: data.data.message,
                  };

                  if (data.data.success) {
                    try {
                      const structureRes = await fetch(
                        `/api/sessions/${sessionId}/structure`
                      );
                      if (structureRes.ok) {
                        const structureData = await structureRes.json();
                        setStructureData(structureData);
                      }
                    } catch (err) {
                      console.error("Error fetching structure:", err);
                    }
                  }
                } else if (data.type === "turn_start") {
                  activity = { type: "turn_start", turn: data.data.turn };
                } else if (data.type === "error") {
                  activity = { type: "error", message: data.data.message };
                }

                if (activity) {
                  activitiesRef.current.push(activity);
                  hasNewActivity = true;
                }
              } catch (parseErr) {
                console.error("Error parsing SSE data:", parseErr, line);
              }
            }
          }

          if (hasNewActivity) {
            syncActivities();
          }
        }
      } catch (error) {
        console.error("Chat error:", error);
        if (isMountedRef.current && requestIdRef.current === requestId) {
          setMessages((prev) => [
            ...prev,
            {
              role: "error",
              content:
                error.name === "AbortError"
                  ? "Request was cancelled."
                  : `Error: ${error.message}`,
            },
          ]);
        }
      } finally {
        if (isMountedRef.current && requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    },
    [sessionId, isLoading, input, messages, setStructureData]
  );

  useInitialMessage(sessionId, messages.length, isLoading, handleSend);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <ChatPanelHeader />

      {/* Messages - scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3">
        {messages.map((msg, idx) => (
          <div key={idx}>
            {msg.role === "user" && (
              <div className={messageBubble()}>
                <div className={roleLabel({ role: "user" })}>You</div>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            )}

            {msg.role === "agent" && (
              <div className={messageBubble()}>
                <div className={roleLabel({ role: "agent" })}>Agent</div>
                <div className="space-y-2">
                  {msg.activities.map((activity, actIdx) => (
                    <div key={actIdx}>
                      {activity.type === "thought" && (
                        <div className={activityText({ type: "thought" })}>
                          {activity.content}
                        </div>
                      )}
                      {activity.type === "tool_call" && (
                        <div className={activityText({ type: "tool_call" })}>
                          <span className="font-medium">→ {activity.name}</span>
                          {Object.keys(activity.args || {}).length > 0 && (
                            <pre className="mt-1.5 p-2 bg-slate-100 rounded-lg text-xs overflow-auto">
                              {JSON.stringify(activity.args, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}
                      {activity.type === "tool_result" && (
                        <div className={activityText({ type: "tool_result" })}>
                          <span className="font-medium">✓ Result</span>
                          <pre className="mt-1.5 p-2 bg-emerald-50 rounded-lg text-xs overflow-auto">
                            {JSON.stringify(activity.result, null, 2)}
                          </pre>
                        </div>
                      )}
                      {activity.type === "complete" && (
                        <div
                          className={`font-semibold text-sm ${
                            activity.success
                              ? "text-emerald-600"
                              : "text-red-500"
                          }`}
                        >
                          {activity.success ? "✓" : "✗"} {activity.message}
                        </div>
                      )}
                      {activity.type === "error" && (
                        <div className={activityText({ type: "error" })}>
                          ⚠ {activity.message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {msg.role === "error" && (
              <div className={messageBubble({ error: true })}>
                {msg.content}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input - fixed at bottom */}
      <div className="p-3 pt-0">
        <PromptBoxWrapper
          value={input}
          onChange={setInput}
          onSubmit={handleSend}
          disabled={!sessionId}
          isLoading={isLoading}
          placeholder="Describe your Minecraft structure..."
        />
      </div>
    </div>
  );
}
