import { useState, useRef, useCallback } from "react";
import { cva, cx } from "class-variance-authority";
import useSessionStore from "../store/sessionStore";
import useAutoScroll from "../hooks/useAutoScroll";
import useInitialMessage from "../hooks/useInitialMessage";
import { PromptBoxWrapper } from "./PromptBox";
import { ThinkingIndicator } from "./ActivityRenderer";

// Message bubble variants
const messageBubble = cva("p-3 text-sm text-slate-700", {
  variants: {
    error: {
      true: "text-red-700",
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

// ============================================================================
// Message Renderers - Render OpenAI conversation format directly
// ============================================================================

function UserMessage({ content }) {
  return (
    <div className={messageBubble()}>
      <div className={roleLabel({ role: "user" })}>You</div>
      <div className="whitespace-pre-wrap">{content}</div>
    </div>
  );
}

function AssistantMessage({ content, toolCalls }) {
  const hasContent = content && content.trim();
  const hasToolCalls = toolCalls && toolCalls.length > 0;

  if (!hasContent && !hasToolCalls) return null;

  return (
    <div className={messageBubble()}>
      <div className={roleLabel({ role: "agent" })}>Agent</div>
      <div className="space-y-2">
        {hasContent && (
          <div className="whitespace-pre-wrap">{content}</div>
        )}
        {hasToolCalls && toolCalls.map((tc, idx) => (
          <ToolCallDisplay key={idx} toolCall={tc} />
        ))}
      </div>
    </div>
  );
}

function ToolCallDisplay({ toolCall }) {
  const name = toolCall.function?.name || "unknown";
  const icon = name === "edit_code" ? "✏️" : name === "complete_task" ? "✓" : "🔧";
  const label = name === "edit_code" ? "Editing code" : name === "complete_task" ? "Validating" : name;

  return (
    <div className="text-sm flex items-center gap-1.5 text-slate-500">
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
    </div>
  );
}

function ToolResultMessage({ name, content }) {
  let result;
  try {
    result = JSON.parse(content);
  } catch {
    result = { output: content };
  }

  const hasError = result?.error;
  const icon = hasError ? "✗" : "✓";
  const label = name === "edit_code" 
    ? (hasError ? "Edit failed" : "Edited code")
    : name === "complete_task"
    ? (hasError ? "Validation failed" : "Validated")
    : (hasError ? "Failed" : "Done");

  return (
    <div className={cx(
      "text-sm flex items-center gap-1.5",
      hasError ? "text-red-500" : "text-emerald-600"
    )}>
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
    </div>
  );
}

function StreamingMessage({ content, isThinking }) {
  return (
    <div className={messageBubble()}>
      <div className={roleLabel({ role: "agent" })}>Agent</div>
      <div className="space-y-2">
        {content && content.trim() && (
          <div className="whitespace-pre-wrap">{content}</div>
        )}
        {isThinking && <ThinkingIndicator />}
      </div>
    </div>
  );
}

function ErrorMessage({ content }) {
  return (
    <div className={messageBubble({ error: true })}>
      {content}
    </div>
  );
}

// ============================================================================
// Main ChatPanel Component
// ============================================================================

export default function ChatPanel() {
  const sessionId = useSessionStore((state) => state.sessionId);
  const conversation = useSessionStore((state) => state.conversation);
  const setConversation = useSessionStore((state) => state.setConversation);
  const setStructureData = useSessionStore((state) => state.setStructureData);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Streaming state - temporary message being built
  const [streamingContent, setStreamingContent] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [localError, setLocalError] = useState(null);

  const abortControllerRef = useRef(null);

  // Derive display messages from conversation (no useEffect needed)
  const displayMessages = conversation || [];

  const messagesEndRef = useAutoScroll([displayMessages, streamingContent, isThinking]);

  const handleSend = useCallback(
    async (messageText = null) => {
      const userMessage = typeof messageText === "string" ? messageText : input;

      if (!userMessage.trim() || !sessionId || isLoading) return;

      setInput("");
      setLocalError(null);
      setStreamingContent("");
      setIsThinking(true);
      setIsLoading(true);

      // Abort any previous request (only when starting new request, not on unmount)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

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
        let accumulatedText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "turn_start") {
                  // New turn starting, show thinking
                  setIsThinking(true);
                } else if (data.type === "text_delta") {
                  // Accumulate text content
                  accumulatedText += data.data.delta;
                  setStreamingContent(accumulatedText);
                  setIsThinking(false);
                } else if (data.type === "tool_call") {
                  // Tool call started - show thinking while it executes
                  setIsThinking(true);
                } else if (data.type === "tool_result") {
                  // Tool finished - thinking for next step
                  setIsThinking(true);
                } else if (data.type === "complete") {
                  // Done - fetch updated conversation and structure
                  setIsThinking(false);
                  
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
                } else if (data.type === "error") {
                  setLocalError(data.data.message);
                  setIsThinking(false);
                }
              } catch (parseErr) {
                console.error("Error parsing SSE data:", parseErr, line);
              }
            }
          }
        }

        // Stream finished - fetch the updated conversation from backend
        try {
          const sessionRes = await fetch(`/api/sessions/${sessionId}`);
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            setConversation(sessionData.conversation || []);
          }
        } catch (err) {
          console.error("Error fetching updated conversation:", err);
        }

      } catch (error) {
        console.error("Chat error:", error);
        if (error.name !== "AbortError") {
          setLocalError(`Error: ${error.message}`);
        }
      } finally {
        // Always reset loading state - React safely ignores updates on unmounted components
        setIsLoading(false);
        setStreamingContent("");
        setIsThinking(false);
      }
    },
    [sessionId, isLoading, input, setStructureData, setConversation]
  );

  useInitialMessage(sessionId, displayMessages.length, isLoading, handleSend);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <ChatPanelHeader />

      {/* Messages - scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3">
        {/* Render conversation from backend */}
        {displayMessages.map((msg, idx) => {
          if (msg.role === "user") {
            return <UserMessage key={idx} content={msg.content} />;
          }
          if (msg.role === "assistant") {
            return (
              <AssistantMessage
                key={idx}
                content={msg.content}
                toolCalls={msg.tool_calls}
              />
            );
          }
          if (msg.role === "tool") {
            return (
              <ToolResultMessage
                key={idx}
                name={msg.name}
                content={msg.content}
              />
            );
          }
          return null;
        })}

        {/* Streaming message (while loading) */}
        {isLoading && (
          <StreamingMessage
            content={streamingContent}
            isThinking={isThinking}
          />
        )}

        {/* Local error */}
        {localError && <ErrorMessage content={localError} />}

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
