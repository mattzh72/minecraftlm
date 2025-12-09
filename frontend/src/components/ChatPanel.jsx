import { useState, useCallback, useMemo } from "react";
import {
  Check,
  X,
  Pencil,
  CircleCheck,
  Wrench,
  ChevronDown,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { cn } from "../lib/cn";
import { Collapsible } from "@base-ui-components/react/collapsible";
import useSessionStore from "../store/sessionStore";
import useChatStore, { ChatState } from "../store/chatStore";
import useAutoScroll from "../hooks/useAutoScroll";
import useInitialMessage from "../hooks/useInitialMessage";
import { PromptBox } from "./PromptBox";
import { ThinkingIndicator, ThoughtDisplay } from "./ActivityRenderer";
import {
  formatConversationToUIMessages,
  getToolCallLabel,
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
// Message Renderers
// ============================================================================

function UserMessage({ content }) {
  return (
    <div className="text-sm text-slate-700 bg-slate-100 border border-slate-200 rounded-lg p-2">
      <div className="whitespace-pre-wrap">{content}</div>
    </div>
  );
}

function AssistantMessage({ content, thought_summary, tool_calls }) {
  const hasContent = content && content.trim();
  const hasThought = thought_summary && thought_summary.trim();
  const hasToolCalls = tool_calls && tool_calls.length > 0;

  if (!hasContent && !hasToolCalls && !hasThought) return null;

  return (
    <div className="py-3 text-sm text-slate-700 border-b border-slate-100">
      <div className="space-y-2">
        {hasThought && <ThoughtDisplay content={thought_summary} isStreaming={false} />}
        {hasContent && (
          <div className="prose prose-sm prose-slate max-w-none">
            <Streamdown>{content}</Streamdown>
          </div>
        )}
        {hasToolCalls &&
          tool_calls.map((tc, idx) => (
            <ToolCallWithResultDisplay key={tc.id || idx} toolCall={tc} />
          ))}
      </div>
    </div>
  );
}

/**
 * Unified tool call display
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
      const rawContent = hasError ? parsed.error : parsed.result;
      // Only set displayContent if it's a non-empty string
      if (rawContent && typeof rawContent === 'string' && rawContent.trim()) {
        displayContent = rawContent;
      }
    } catch {
      if (result.content.trim()) {
        displayContent = result.content;
      }
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

  // Only expandable if there's actual content to show
  const isExpandable = !!displayContent;
  const shouldDefaultOpen = hasError && isExpandable;

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
      <Collapsible.Trigger className="group w-full text-left py-1 flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors cursor-pointer">
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
            className="absolute inset-0 text-slate-400 opacity-0 transition-all group-hover:opacity-100 group-data-[panel-open]:rotate-180"
          />
        </span>
        <span className="font-medium">{label}</span>
      </Collapsible.Trigger>
      <Collapsible.Panel className="h-[--collapsible-panel-height] overflow-hidden transition-[height] duration-200 ease-out data-[starting-style]:h-0 data-[ending-style]:h-0">
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
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}

function StreamingMessage({ thought, text, state }) {
  const isThinking = state === ChatState.THINKING || state === ChatState.TOOL_CALLING;
  const isStreamingThought = state === ChatState.STREAMING_THOUGHT;
  const hasThought = thought && thought.trim();
  const hasText = text && text.trim();

  return (
    <div className="py-3 text-sm text-slate-700">
      <div className="space-y-2">
        {hasThought && <ThoughtDisplay content={thought} isStreaming={isStreamingThought} />}
        {hasText && (
          <div className="prose prose-sm prose-slate max-w-none">
            <Streamdown mode="streaming">{text}</Streamdown>
          </div>
        )}
        {isThinking && !hasThought && !hasText && <ThinkingIndicator />}
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

  // Chat store state
  const chatState = useChatStore((state) => state.state);
  const streamingThought = useChatStore((state) => state.streamingThought);
  const streamingText = useChatStore((state) => state.streamingText);
  const pendingUserMessage = useChatStore((state) => state.pendingUserMessage);
  const error = useChatStore((state) => state.error);

  // Get actions object once
  const actions = useChatStore((state) => state.actions);

  const [input, setInput] = useState("");

  const isLoading = chatState !== ChatState.IDLE && chatState !== ChatState.ERROR;

  // Format conversation into UI-friendly messages
  const displayMessages = useMemo(
    () => formatConversationToUIMessages(conversation || []),
    [conversation]
  );

  const messagesEndRef = useAutoScroll([
    displayMessages,
    pendingUserMessage,
    streamingThought,
    streamingText,
    chatState,
  ]);

  const handleSend = useCallback(
    async (messageText = null) => {
      const userMessage = typeof messageText === "string" ? messageText : input;

      if (!userMessage.trim() || !sessionId || isLoading) return;

      setInput("");
      const abortController = actions.startRequest(userMessage);

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
                  actions.onTurnStart();
                } else if (data.type === "thought") {
                  actions.onThoughtDelta(data.data.delta);
                } else if (data.type === "text_delta") {
                  actions.onTextDelta(data.data.delta);
                } else if (data.type === "tool_call") {
                  actions.onToolCall(data.data.name, data.data.args);
                } else if (data.type === "tool_result") {
                  actions.onToolResult(data.data);
                } else if (data.type === "complete") {
                  actions.onComplete(data.data.success, data.data.reason);

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
                  actions.onError(data.data.message);
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
              actions.onThoughtDelta(data.data.delta);
            } else if (data.type === "text_delta") {
              actions.onTextDelta(data.data.delta);
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
            actions.clearPendingMessage();
            setConversation(sessionData.conversation || []);
          }
        } catch (err) {
          console.error("Error fetching updated conversation:", err);
        }
      } catch (err) {
        console.error("Chat error:", err);
        if (err.name !== "AbortError") {
          actions.onError(`Error: ${err.message}`);
        }
        actions.clearPendingMessage();
      } finally {
        // Reset if still in a loading state (handles edge cases)
        const currentState = useChatStore.getState().state;
        if (currentState !== ChatState.IDLE && currentState !== ChatState.ERROR) {
          actions.reset();
        }
      }
    },
    [sessionId, isLoading, input, setStructureData, setConversation, actions]
  );

  useInitialMessage(sessionId, displayMessages.length, isLoading, handleSend);

  return (
    <div className="flex flex-col h-full">
      <ChatPanelHeader />

      {/* Messages - scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 space-y-2 pt-2">
        {displayMessages.map((msg, idx) => {
          if (msg.type === "user") {
            return <UserMessage key={idx} content={msg.content} />;
          }
          if (msg.type === "assistant") {
            return (
              <AssistantMessage
                key={idx}
                content={msg.content}
                thought_summary={msg.thought_summary}
                tool_calls={msg.tool_calls}
              />
            );
          }
          return null;
        })}

        {/* Pending user message */}
        {pendingUserMessage &&
          !displayMessages.some(
            (msg) => msg.type === "user" && msg.content === pendingUserMessage
          ) && <UserMessage content={pendingUserMessage} />}

        {/* Streaming message */}
        {isLoading && (
          <StreamingMessage
            thought={streamingThought}
            text={streamingText}
            state={chatState}
          />
        )}

        {/* Error */}
        {error && <ErrorMessage content={error} />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
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
