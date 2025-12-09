import { useState, useRef, useCallback } from "react";
import { cva } from "class-variance-authority";
import {
  Check,
  X,
  Pencil,
  CircleCheck,
  Wrench,
  ChevronRight,
} from "lucide-react";
import { cn } from "../lib/cn";
import { Collapsible } from "@base-ui-components/react/collapsible";
import useSessionStore from "../store/sessionStore";
import useAutoScroll from "../hooks/useAutoScroll";
import useInitialMessage from "../hooks/useInitialMessage";
import { PromptBox } from "./PromptBox";
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
        {hasContent && <div className="whitespace-pre-wrap">{content}</div>}
        {hasToolCalls &&
          toolCalls.map((tc, idx) => (
            <ToolCallDisplay key={idx} toolCall={tc} />
          ))}
      </div>
    </div>
  );
}

function ToolCallDisplay({ toolCall }) {
  const name = toolCall.function?.name || "unknown";
  const label =
    name === "edit_code"
      ? "Editing code"
      : name === "complete_task"
      ? "Validating"
      : name;

  let args = null;
  try {
    args = JSON.parse(toolCall.function?.arguments || "{}");
  } catch {
    args = { raw: toolCall.function?.arguments };
  }

  const shouldRenderCollapsible = args !== null;

  const IconComponent =
    name === "edit_code"
      ? Pencil
      : name === "complete_task"
      ? CircleCheck
      : Wrench;

  const baseNode = (
    <div className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors group">
      <ChevronRight
        size={12}
        className="text-slate-400 transition-transform group-data-panel-open:rotate-90"
      />
      <IconComponent size={14} />
      <span className="font-medium">{label}</span>
    </div>
  );

  return shouldRenderCollapsible ? (
    <Collapsible.Root className="text-sm">
      <Collapsible.Trigger asChild>{baseNode}</Collapsible.Trigger>
    </Collapsible.Root>
  ) : (
    baseNode
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
  const label =
    name === "edit_code"
      ? hasError
        ? "Edit failed"
        : "Edited code"
      : name === "complete_task"
      ? hasError
        ? "Validation failed"
        : "Validated"
      : hasError
      ? "Failed"
      : "Done";

  const displayContent = hasError ? result.error : result.output;

  return (
    <Collapsible.Root className="text-sm" defaultOpen={hasError}>
      <Collapsible.Trigger className="flex items-center gap-1.5 text-slate-600 hover:text-slate-700 transition-colors group">
        <ChevronRight
          size={12}
          className="text-slate-400 transition-transform group-data-panel-open:rotate-90"
        />
        {hasError ? (
          <X size={14} className="text-red-500" />
        ) : (
          <Check size={14} className="text-emerald-600" />
        )}
        <span className="font-medium">{label}</span>
      </Collapsible.Trigger>
      {displayContent && (
        <Collapsible.Panel className="mt-1.5 ml-5">
          <pre
            className={cn(
              "p-2 rounded-lg text-xs overflow-auto max-h-48",
              hasError
                ? "bg-red-50 text-red-700"
                : "bg-slate-100 text-slate-600"
            )}
          >
            {displayContent}
          </pre>
        </Collapsible.Panel>
      )}
    </Collapsible.Root>
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
  return <div className={messageBubble({ error: true })}>{content}</div>;
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

  // Pending user message - shown immediately while waiting for backend
  const [pendingUserMessage, setPendingUserMessage] = useState(null);

  // Streaming state - temporary message being built
  const [streamingContent, setStreamingContent] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [localError, setLocalError] = useState(null);

  const abortControllerRef = useRef(null);

  // Derive display messages from conversation (no useEffect needed)
  const displayMessages = conversation || [];

  const messagesEndRef = useAutoScroll([
    displayMessages,
    pendingUserMessage,
    streamingContent,
    isThinking,
  ]);

  const handleSend = useCallback(
    async (messageText = null) => {
      const userMessage = typeof messageText === "string" ? messageText : input;

      if (!userMessage.trim() || !sessionId || isLoading) return;

      setInput("");
      setLocalError(null);
      setPendingUserMessage(userMessage);
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
        let lineBuffer = "";
        let eventLines = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split(/\r?\n/);
          lineBuffer = lines.pop() || "";

          for (const line of lines) {
            if (line === "") {
              if (eventLines.length === 0) {
                continue;
              }
              const dataStr = eventLines.join("\n");
              eventLines = [];

              try {
                const data = JSON.parse(dataStr);

                if (data.type === "turn_start") {
                  setIsThinking(true);
                } else if (data.type === "thought") {
                  setStreamingContent((prev) => prev + data.data.delta);
                  setIsThinking(true);
                } else if (data.type === "text_delta") {
                  accumulatedText += data.data.delta;
                  setStreamingContent(accumulatedText);
                  setIsThinking(false);
                } else if (data.type === "tool_call") {
                  setIsThinking(true);
                } else if (data.type === "tool_result") {
                  setIsThinking(true);
                } else if (data.type === "complete") {
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
                console.error("Error parsing SSE data:", parseErr, dataStr);
              }
            } else if (line.startsWith("data:")) {
              eventLines.push(line.slice(5).trimStart());
            }
          }
        }

        // Process any trailing event lines when stream ends
        if (eventLines.length > 0) {
          const dataStr = eventLines.join("\n");
          try {
            const data = JSON.parse(dataStr);
            if (data.type === "thought") {
              setStreamingContent((prev) => prev + data.data.delta);
            } else if (data.type === "text_delta") {
              accumulatedText += data.data.delta;
              setStreamingContent(accumulatedText);
            }
          } catch (parseErr) {
            console.error("Error parsing trailing SSE data:", parseErr, dataStr);
          }
        }

        // Stream finished - fetch the updated conversation from backend
        try {
          const sessionRes = await fetch(`/api/sessions/${sessionId}`);
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            setConversation(sessionData.conversation || []);
            setPendingUserMessage(null); // Clear pending now that we have real data
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
        setPendingUserMessage(null);
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

        {/* Pending user message (shown immediately while loading) */}
        {pendingUserMessage && (
          <UserMessage content={pendingUserMessage} />
        )}

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
        <PromptBox
          value={input}
          onChange={setInput}
          onSubmit={handleSend}
          disabled={!sessionId || isLoading}
          placeholder="Describe your Minecraft structure..."
          className="border-slate-300"
        />
      </div>
    </div>
  );
}
