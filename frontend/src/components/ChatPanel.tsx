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
import { useChat } from "@/hooks/use-chat";
import { PromptBox } from "./PromptBox.tsx";
import { AgentScroller } from "./AgentScroller";
import { ThinkingIndicator, ThoughtDisplay } from "./ActivityRenderer";
import { getToolCallLabel } from "@/lib/formatConversation";
import type { ToolCallWithResult } from "@/lib/schemas";
import { useStore } from "@/store/index.ts";
import { formatConversationToUIMessages } from "@/lib/formatConversation";
import { useMemo } from "react";
import { useResizable } from "@/hooks/useResizable";

type UserMessageProps = {
  content: string;
};

function UserMessage({ content }: UserMessageProps) {
  return (
    <div className="text-sm text-white/90 bg-black/30 rounded-lg p-2.5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]">
      <div className="whitespace-pre-wrap">{content}</div>
    </div>
  );
}

type AssistantMessageProps = {
  content: string;
  thought_summary: string;
  tool_calls: ToolCallWithResult[];
  isStreaming: boolean;
};

function AssistantMessage({
  content,
  thought_summary,
  tool_calls,
  isStreaming = false,
}: AssistantMessageProps) {
  const hasContent = content && content.trim();
  const hasThought = thought_summary && thought_summary.trim();
  const hasToolCalls = tool_calls && tool_calls.length > 0;

  // Show thinking indicator when streaming with no content yet
  const showThinkingIndicator = isStreaming && !hasThought && !hasContent;

  return (
    <div className="py-3 text-sm text-white/85 border-b border-white/10">
      <div className="space-y-2">
        {hasThought && (
          <ThoughtDisplay content={thought_summary} isStreaming={isStreaming} />
        )}
        {hasContent && (
          <div className="prose prose-sm prose-slate max-w-none dark:prose-invert">
            <Streamdown mode={isStreaming ? "streaming" : "static"}>
              {content}
            </Streamdown>
          </div>
        )}
        {hasToolCalls &&
          tool_calls.map((tc, idx) => (
            <ToolCallWithResultDisplay
              key={tc.id || idx}
              toolCall={{
                name: tc.name,
                arguments: tc.arguments,
                id: tc.id,
                result: tc.result,
              }}
            />
          ))}
        {showThinkingIndicator && <ThinkingIndicator />}
      </div>
    </div>
  );
}

type ToolCallWithResultDisplayProps = {
  toolCall: ToolCallWithResult;
};

function ToolCallWithResultDisplay({
  toolCall,
}: ToolCallWithResultDisplayProps) {
  const { name, result } = toolCall;
  const hasResult = !!result;
  const hasError = result?.hasError || false;

  const label = getToolCallLabel(name, hasResult, hasError);

  let displayContent = null;
  if (result?.content) {
    try {
      const parsed = JSON.parse(result.content);
      const rawContent = hasError ? parsed.error : parsed.result;
      if (rawContent && typeof rawContent === "string" && rawContent.trim()) {
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
      : Wrench
    : hasError
      ? X
      : Check;

  const iconColor = !hasResult
    ? "text-white/50"
    : hasError
      ? "text-red-400"
      : "text-emerald-400";

  const isExpandable = !!displayContent;
  const shouldDefaultOpen = hasError && isExpandable;

  if (!isExpandable) {
    return (
      <div className="text-sm py-1 flex items-center gap-1.5 text-white/60">
        <IconComponent size={14} className={iconColor} />
        <span className="font-medium">{label}</span>
      </div>
    );
  }

  return (
    <Collapsible className="text-sm" defaultOpen={shouldDefaultOpen}>
      <CollapsibleTrigger className="group w-full text-left py-1 flex items-center gap-1.5 text-white/60 hover:text-white/90 transition-colors">
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
            className="absolute inset-0 text-white/50 opacity-0 transition-all group-hover:opacity-100 group-data-[panel-open]:rotate-180"
          />
        </span>
        <span className="font-medium">{label}</span>
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <pre
          className={cn(
            "mt-1.5 p-2 rounded-lg text-xs overflow-auto max-h-48",
            hasError
              ? "bg-red-500/20 text-red-300"
              : "bg-black/20 text-white/60"
          )}
        >
          {displayContent}
        </pre>
      </CollapsiblePanel>
    </Collapsible>
  );
}

type ErrorMessageProps = {
  content: string;
};

function ErrorMessage({ content }: ErrorMessageProps) {
  return (
    <div className="py-3 text-sm text-red-400">
      <div className="whitespace-pre-wrap">{content}</div>
    </div>
  );
}

function MessageList() {
  const activeSessionId = useStore((s) => s.activeSessionId);
  const sessions = useStore((s) => s.sessions);
  const activeSession = useMemo(() => {
    return activeSessionId ? sessions[activeSessionId] : null;
  }, [activeSessionId, sessions]);
  const messages = formatConversationToUIMessages(
    activeSession?.conversation ?? []
  );
  const agentState = useStore((s) => s.agentState);
  const isLoading = agentState !== "idle" && agentState !== "error";
  const error = useStore((s) => s.error);
  return (
    <>
      {messages.map((msg, idx) => {
        const isLastAssistant =
          msg.type === "assistant" && idx === messages.length - 1;
        const isStreaming = isLoading && isLastAssistant;
        const messageKey = `${msg.type}-${idx}`;

        if (msg.type === "user") {
          return <UserMessage key={messageKey} content={msg.content} />;
        }
        if (msg.type === "assistant") {
          return (
            <AssistantMessage
              key={messageKey}
              content={msg.content}
              thought_summary={msg.thought_summary || ""}
              tool_calls={msg.tool_calls}
              isStreaming={isStreaming}
            />
          );
        }
        return null;
      })}

      {/* Show thinking indicator when loading but no assistant message is streaming yet */}
      {isLoading &&
        (messages.length === 0 ||
          messages[messages.length - 1].type !== "assistant") && (
          <div className="py-3 text-sm text-white/70">
            <ThinkingIndicator />
          </div>
        )}
      {error && <ErrorMessage content={error} />}
    </>
  );
}

type ChatPanelProps = {
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  width: number;
  onWidthChange: (width: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
};

const MIN_WIDTH = 320;
const MAX_WIDTH = 600;

const GLASS_PANEL_CLASSES = cn(
  "bg-black/30 backdrop-blur-2xl backdrop-saturate-150",
  "border border-white/15",
  "shadow-xl shadow-black/20",
  "ring-1 ring-inset ring-white/10",
  "rounded-2xl"
);

export function ChatPanel({ expanded, setExpanded, width, onWidthChange, onResizeStart, onResizeEnd }: ChatPanelProps) {
  const { handleSend } = useChat();

  const activeSessionId = useStore((s) => s.activeSessionId);
  const sessions = useStore((s) => s.sessions);
  const agentState = useStore((s) => s.agentState);
  const activeSession = useMemo(() => {
    return activeSessionId ? sessions[activeSessionId] : null;
  }, [activeSessionId, sessions]);

  const isAgentBusy = agentState !== "idle" && agentState !== "error";

  const { handleResizeStart } = useResizable({
    width,
    minWidth: MIN_WIDTH,
    maxWidth: MAX_WIDTH,
    onWidthChange,
    onResizeStart,
    onResizeEnd,
  });

  const handleSubmit = (value: string) => {
    if (activeSession?.session_id) {
      handleSend(value, activeSession.session_id);
    } else {
      console.warn("No active session");
    }
  };

  return (
    <div className={cn(GLASS_PANEL_CLASSES, "flex flex-col h-full")}>
      {/* Resize handle on left edge - only when expanded */}
      {expanded && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 group"
        >
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white/0 group-hover:bg-white/30 transition-colors" />
        </div>
      )}

      {/* Header with title and collapse button */}
      <div className={cn(
        "flex items-center justify-between px-4 shrink-0",
        expanded ? "py-2 border-b border-white/10" : "py-2.5"
      )}>
        <h2 className="font-semibold text-sm text-white/90">Chat</h2>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 flex items-center justify-center transition-all hover:scale-105"
          aria-label={expanded ? "Collapse chat" : "Expand chat"}
        >
          <ChevronUp
            size={16}
            className={cn(
              "text-white/60 transition-transform duration-300",
              !expanded && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Body - Messages and Input */}
      {expanded && (
        <>
          <div className="flex-1 min-h-0 overflow-clip">
            <AgentScroller autoScrollDeps={[activeSession?.conversation]}>
              <MessageList />
            </AgentScroller>
          </div>

          <div className="p-2 pt-0">
            <PromptBox
              onSubmit={handleSubmit}
              disabled={!activeSession?.session_id || isAgentBusy}
              placeholder="Design more..."
            />
          </div>
        </>
      )}
    </div>
  );
}
