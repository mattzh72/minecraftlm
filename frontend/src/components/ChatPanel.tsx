import {
  Check,
  X,
  Pencil,
  CircleCheck,
  Wrench,
  ChevronDown,
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
import { Frame, FramePanel, FrameTitle } from "./ui/frame.tsx";
import { useMemo } from "react";

type UserMessageProps = {
  content: string;
};

function UserMessage({ content }: UserMessageProps) {
  return (
    <div className="text-sm text-foreground bg-muted border border-border rounded-lg p-2">
      <div className="whitespace-pre-wrap">{content}</div>
    </div>
  );
}

type AssistantMessageProps = {
  content: string;
  thought_summary: string;
  tool_calls: ToolCallWithResult[];
  isStreaming: boolean;
  log: boolean;
};

function AssistantMessage({
  content,
  thought_summary,
  tool_calls,
  isStreaming = false,
  log = false,
}: AssistantMessageProps) {
  const hasContent = content && content.trim();
  const hasThought = thought_summary && thought_summary.trim();
  const hasToolCalls = tool_calls && tool_calls.length > 0;

  // Show thinking indicator when streaming with no content yet
  const showThinkingIndicator = isStreaming && !hasThought && !hasContent;

  if (log) {
    console.log({
      hasContent,
      hasThought,
      hasToolCalls,
      showThinkingIndicator,
    });
  }

  return (
    <div className="py-3 text-sm text-foreground border-b border-border/50">
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

type ErrorMessageProps = {
  content: string;
};

function ErrorMessage({ content }: ErrorMessageProps) {
  return (
    <div className="py-3 text-sm text-destructive">
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
  console.log(`[MessageList] activeSession`, activeSession);
  const messages = formatConversationToUIMessages(
    activeSession?.conversation ?? []
  );
  const agentState = useStore((s) => s.agentState);
  const isLoading = agentState !== "idle" && agentState !== "error";
  const error = useStore((s) => s.error);
  console.log(`messageList`, { messages, agentState, isLoading, error, activeSession });
  return (
    <>
      {messages.map((msg, idx) => {
        const isLastAssistant =
          msg.type === "assistant" && idx === messages.length - 1;
        const isStreaming = isLoading && isLastAssistant;

        if (msg.type === "user") {
          return <UserMessage key={idx} content={msg.content} />;
        }
        if (msg.type === "assistant") {
          return (
            <AssistantMessage
              key={idx}
              log={isStreaming}
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
          <div className="py-3 text-sm text-foreground">
            <ThinkingIndicator />
          </div>
        )}
      {error && <ErrorMessage content={error} />}
    </>
  );
}

export function ChatPanel() {
  const { handleSend } = useChat();

  const activeSessionId = useStore((s) => s.activeSessionId);
  const sessions = useStore((s) => s.sessions);
  const agentState = useStore((s) => s.agentState);
  const activeSession = useMemo(() => {
    return activeSessionId ? sessions[activeSessionId] : null;
  }, [activeSessionId, sessions]);

  const isAgentBusy = agentState !== "idle" && agentState !== "error";

  const handleSubmit = (value: string) => {
    if (activeSession?.session_id) {
      handleSend(value, activeSession.session_id);
    } else {
      console.warn("No active session");
    }
  };

  return (
    <Frame className="flex flex-col w-sm m-3 ml-0">
      <FramePanel className="py-3">
        <FrameTitle>Chat</FrameTitle>
      </FramePanel>
      <FramePanel className="flex-1 min-h-0 p-0 overflow-clip mb-2">
        <AgentScroller autoScrollDeps={[activeSession?.conversation]}>
          <MessageList />
        </AgentScroller>
      </FramePanel>

      <PromptBox
        onSubmit={handleSubmit}
        disabled={!activeSession?.session_id || isAgentBusy}
        placeholder="Describe your Minecraft structure..."
      />
    </Frame>
  );
}
