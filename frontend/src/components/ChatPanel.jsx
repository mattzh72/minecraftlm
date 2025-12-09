import { useState, useRef, useCallback, useMemo } from "react";
import {
  Check,
  X,
  Pencil,
  CircleCheck,
  Wrench,
  ChevronDown,
} from "lucide-react";
import { cn } from "../lib/cn";
import { Collapsible } from "@base-ui-components/react/collapsible";
import useSessionStore from "../store/sessionStore";
import useAutoScroll from "../hooks/useAutoScroll";
import useInitialMessage from "../hooks/useInitialMessage";
import { PromptBox } from "./PromptBox";
import { ThinkingIndicator } from "./ActivityRenderer";
import {
  formatConversationToUIMessages,
  getToolCallLabel,
  hasExpandableContent,
} from "../lib/formatConversation";

// Header component
function ChatPanelHeader() {
  return (
    <div className="px-4 py-3 border-b border-slate-200/50">
      <h2 className="text-sm font-medium text-slate-700">Chat</h2>
    </div>
  );
}

// ============================================================================
// Message Renderers - Cursor-style full-width messages
// ============================================================================

function UserMessage({ content }) {
  return (
    <div className="text-sm text-slate-700 bg-slate-100 border border-slate-200 rounded-lg p-2">
      <div className="whitespace-pre-wrap">{content}</div>
    </div>
  );
}

function AssistantMessage({ content, tool_calls }) {
  const hasContent = content && content.trim();
  const hasToolCalls = tool_calls && tool_calls.length > 0;

  if (!hasContent && !hasToolCalls) return null;

  return (
    <div className="py-3 text-sm text-slate-700 border-b border-slate-100">
      <div className="space-y-2">
        {hasContent && <div className="whitespace-pre-wrap">{content}</div>}
        {hasToolCalls &&
          tool_calls.map((tc, idx) => (
            <ToolCallWithResultDisplay key={tc.id || idx} toolCall={tc} />
          ))}
      </div>
    </div>
  );
}

/**
 * Unified tool call display - toggle on the right side to avoid offset
 */
function ToolCallWithResultDisplay({ toolCall }) {
  const { name, result } = toolCall;
  const hasResult = !!result;
  const hasError = result?.hasError || false;

  const label = getToolCallLabel(name, hasResult, hasError);

  let displayContent = null;
  if (result?.content) {
    try {
      const parsed = JSON.parse(result.content);
      displayContent = hasError ? parsed.error : parsed.result;
    } catch {
      displayContent = result.content;
    }
  }

  const IconComponent = !hasResult
    ? name === "edit_code"
      ? Pencil
      : name === "complete_task"
      ? CircleCheck
      : Wrench
    : hasError
    ? X
    : Check;

  const iconColor = !hasResult
    ? "text-slate-400"
    : hasError
    ? "text-red-500"
    : "text-emerald-600";

  const isExpandable = hasExpandableContent(toolCall);
  const shouldDefaultOpen = hasError;

  if (!isExpandable) {
    return (
      <div className="text-sm py-1 flex items-center gap-1.5 text-slate-500">
        <IconComponent size={14} className={iconColor} />
        <span className="font-medium">{label}</span>
      </div>
    );
  }

  return (
    <Collapsible.Root className="text-sm" defaultOpen={shouldDefaultOpen}>
      <Collapsible.Trigger
        disabled={!displayContent}
        className="group w-full text-left py-1 flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
      >
        <span className="relative size-3.5">
          <IconComponent
            size={14}
            className={cn(
              iconColor,
              "absolute inset-0 transition-opacity group-hover:opacity-0"
            )}
          />
          <ChevronDown
            size={14}
            className="absolute inset-0 text-slate-400 opacity-0 transition-all group-hover:opacity-100 group-data-panel-open:rotate-180"
          />
        </span>
        <span className="font-medium">{label}</span>
      </Collapsible.Trigger>
      <Collapsible.Panel
        keepMounted
        className={cn(
          "grid grid-rows-[1fr] transition-[grid-template-rows] duration-200 ease-out",
          "data-closed:grid-rows-[0fr]",
          "data-starting-style:grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden min-h-0">
          {displayContent && (
            <pre
              className={cn(
                "mt-1.5 p-2 rounded-lg text-xs overflow-auto max-h-48",
                hasError
                  ? "bg-red-50 text-red-700"
                  : "bg-slate-50 text-slate-600"
              )}
            >
              {displayContent}
            </pre>
          )}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

function StreamingMessage({ content, isThinking }) {
  return (
    <div className="py-3 text-sm text-slate-700">
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
    <div className="py-3 text-sm text-red-600">
      <div className="whitespace-pre-wrap">{content}</div>
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

  // Pending user message - shown immediately while waiting for backend
  const [pendingUserMessage, setPendingUserMessage] = useState(null);

  // Streaming state - temporary message being built
  const [streamingContent, setStreamingContent] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [localError, setLocalError] = useState(null);

  const abortControllerRef = useRef(null);

  // Format conversation into UI-friendly messages (groups tool calls with results)
  const displayMessages = useMemo(
    () => formatConversationToUIMessages(conversation || []),
    [conversation]
  );

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
      <div className="flex-1 overflow-y-auto min-h-0 px-3 space-y-2 pt-2">
        {/* Render formatted UI messages (tool results are grouped with their calls) */}
        {displayMessages.map((msg, idx) => {
          if (msg.type === "user") {
            return <UserMessage key={idx} content={msg.content} />;
          }
          if (msg.type === "assistant") {
            return (
              <AssistantMessage
                key={idx}
                content={msg.content}
                tool_calls={msg.tool_calls}
              />
            );
          }
          return null;
        })}

        {/* Pending user message (shown immediately while loading) */}
        {pendingUserMessage && <UserMessage content={pendingUserMessage} />}

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
