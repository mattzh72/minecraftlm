import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Check,
  X,
  Pencil,
  CircleCheck,
  Wrench,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsiblePanel,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/group";
import useSessionStore from "@/store/sessionStore";
import useChatStore, { ChatState } from "@/store/chatStore";
import useInitialMessage from "@/hooks/useInitialMessage";
import { PromptBox } from "./PromptBox";
import { ThinkingIndicator, ThoughtDisplay } from "./ActivityRenderer";
import {
  formatConversationToUIMessages,
  getToolCallLabel,
} from "@/lib/formatConversation";

// ============================================================================
// Message Renderers
// ============================================================================

function UserMessage({ content }) {
  return (
    <div className="text-sm text-foreground bg-muted border border-border rounded-lg p-2">
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
    <div className="py-3 text-sm text-foreground border-b border-border/50">
      <div className="space-y-2">
        {hasThought && <ThoughtDisplay content={thought_summary} isStreaming={false} />}
        {hasContent && (
          <div className="prose prose-sm prose-slate max-w-none dark:prose-invert">
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
 * Tool call display using coss Collapsible
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
    ? "text-muted-foreground"
    : hasError
    ? "text-destructive"
    : "text-success";

  // Only expandable if there's actual content to show
  const isExpandable = !!displayContent;
  const shouldDefaultOpen = hasError && isExpandable;

  if (!isExpandable) {
    return (
      <div className="text-sm py-1 flex items-center gap-1.5 text-muted-foreground">
        <IconComponent size={14} className={iconColor} />
        <span className="font-medium">{label}</span>
      </div>
    );
  }

  return (
    <Collapsible className="text-sm" defaultOpen={shouldDefaultOpen}>
      <CollapsibleTrigger className="group w-full text-left py-1 flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
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
            className="absolute inset-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-data-[panel-open]:rotate-180"
          />
        </span>
        <span className="font-medium">{label}</span>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <pre
          className={cn(
            "mt-1.5 p-2 rounded-lg text-xs overflow-auto max-h-48",
            hasError
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground"
          )}
        >
          {displayContent}
        </pre>
      </CollapsiblePanel>
    </Collapsible>
  );
}

function StreamingMessage({ thought, text, state }) {
  const isThinking = state === ChatState.THINKING || state === ChatState.TOOL_CALLING;
  const isStreamingThought = state === ChatState.STREAMING_THOUGHT;
  const hasThought = thought && thought.trim();
  const hasText = text && text.trim();

  return (
    <div className="py-3 text-sm text-foreground">
      <div className="space-y-2">
        {hasThought && <ThoughtDisplay content={thought} isStreaming={isStreamingThought} />}
        {hasText && (
          <div className="prose prose-sm prose-slate max-w-none dark:prose-invert">
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
    <div className="py-3 text-sm text-destructive">
      <div className="whitespace-pre-wrap">{content}</div>
    </div>
  );
}

// ============================================================================
// Main ChatPanel Component
// ============================================================================

export function useChatPanel() {
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
  const [showTopButton, setShowTopButton] = useState(false);
  const [showBottomButton, setShowBottomButton] = useState(false);

  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);

  const isLoading = chatState !== ChatState.IDLE && chatState !== ChatState.ERROR;

  // Format conversation into UI-friendly messages
  const displayMessages = useMemo(
    () => formatConversationToUIMessages(conversation || []),
    [conversation]
  );

  // Handle scroll position to show/hide jump button and masks
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const threshold = 100;

    const isAwayFromTop = scrollTop > threshold;
    const isAwayFromBottom = scrollTop < scrollHeight - clientHeight - threshold;

    // Only show masks when away from respective edges
    setShowTopButton(isAwayFromTop);
    setShowBottomButton(isAwayFromBottom);
  }, []);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages, pendingUserMessage, streamingThought, streamingText, chatState]);

  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

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

  // Only show button group when away from BOTH edges (i.e., in the middle)
  const showJumpButton = showTopButton && showBottomButton;

  return {
    messages: (
      <div className="relative flex-1 min-h-0">
        {/* Top scroll mask */}
        <div
          className={cn(
            "absolute top-0 inset-x-0 h-12 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none transition-opacity duration-200",
            showTopButton ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Scrollable messages container */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto px-3 space-y-2 py-2"
        >
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

        {/* Bottom scroll mask */}
        <div
          className={cn(
            "absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none transition-opacity duration-200",
            showBottomButton ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Jump button group - bottom right */}
        <ButtonGroup
          orientation="vertical"
          className={cn(
            "absolute bottom-3 right-3 z-50 transition-all duration-200",
            showJumpButton ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none"
          )}
        >
          <Button variant="outline" size="icon-sm" onClick={scrollToTop}>
            <ChevronUp size={14} />
          </Button>
          <ButtonGroupSeparator orientation="horizontal" />
          <Button variant="outline" size="icon-sm" onClick={scrollToBottom}>
            <ChevronDown size={14} />
          </Button>
        </ButtonGroup>
      </div>
    ),
    input: (
      <PromptBox
        value={input}
        onChange={setInput}
        onSubmit={handleSend}
        disabled={!sessionId || isLoading}
        placeholder="Describe your Minecraft structure..."
      />
    ),
  };
}