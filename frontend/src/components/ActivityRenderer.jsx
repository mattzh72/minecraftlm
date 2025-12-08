import { useState } from "react";
import { match } from "ts-pattern";
import { cx } from "class-variance-authority";
import { getToolInfo } from "../lib/activities";

// ============================================================================
// Collapsible Details Component
// ============================================================================

function CollapsibleDetails({ label, icon, variant = "default", children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const variantStyles = {
    default: "text-slate-500",
    success: "text-emerald-600",
    error: "text-red-500",
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cx(
          "text-sm flex items-center gap-1.5 transition-colors hover:opacity-80",
          variantStyles[variant]
        )}
      >
        <span
          className={cx(
            "text-xs text-slate-400 transition-transform duration-150",
            isOpen && "rotate-90"
          )}
        >
          ▶
        </span>
        {icon && <span>{icon}</span>}
        <span className="font-medium">{label}</span>
      </button>
      {isOpen && (
        <pre className="mt-1.5 ml-4 p-2 bg-slate-100 rounded-lg text-xs overflow-auto max-h-48 text-slate-600">
          {children}
        </pre>
      )}
    </div>
  );
}

// ============================================================================
// Shimmer Text (for thinking/loading state)
// ============================================================================

function ShimmerText({ children }) {
  return (
    <span
      className={cx(
        "inline-block",
        "bg-linear-to-r from-slate-600 via-slate-400 to-slate-600",
        "bg-size-[200%_100%]",
        "bg-clip-text text-transparent",
        "animate-shimmer"
      )}
    >
      {children}
    </span>
  );
}

// ============================================================================
// Thinking Indicator (shown while agent is processing)
// ============================================================================

export function ThinkingIndicator() {
  return (
    <div className="text-sm flex items-center gap-1.5">
      <ShimmerText>Thinking...</ShimmerText>
    </div>
  );
}

// ============================================================================
// Activity Renderers
// ============================================================================

function ThoughtActivity({ content, isStreaming = false }) {
  if (!content?.trim()) return null;

  return (
    <div className="text-sm text-slate-600 whitespace-pre-wrap">
      {isStreaming ? <ShimmerText>{content}</ShimmerText> : content}
    </div>
  );
}

function ToolCallActivity({ name, args, isPending = false }) {
  const toolInfo = getToolInfo(name);

  // For edit_code - show shimmer while pending
  if (name === "edit_code") {
    return (
      <div className="text-sm flex items-center gap-1.5 text-slate-500">
        <span>{toolInfo.icon}</span>
        {isPending ? (
          <ShimmerText>{toolInfo.label}</ShimmerText>
        ) : (
          <span className="font-medium">{toolInfo.label}</span>
        )}
      </div>
    );
  }

  // For complete_task - show shimmer while pending
  if (name === "complete_task") {
    return (
      <div className="text-sm flex items-center gap-1.5 text-slate-500">
        <span>✓</span>
        {isPending ? (
          <ShimmerText>Validating code...</ShimmerText>
        ) : (
          <span className="font-medium">Validating code...</span>
        )}
      </div>
    );
  }

  // Generic tool call fallback
  return (
    <div className="text-sm flex items-center gap-1.5 text-slate-500">
      <span>{toolInfo.icon}</span>
      {isPending ? (
        <ShimmerText>{toolInfo.label}</ShimmerText>
      ) : (
        <span className="font-medium">{toolInfo.label}</span>
      )}
    </div>
  );
}

function ToolResultActivity({ result, toolName }) {
  const hasOutput = result?.output;
  const hasError = result?.error;

  // Get friendly label based on tool
  const getResultLabel = (isError) => {
    if (toolName === "edit_code") {
      return isError ? "Edit failed" : "Edited code";
    }
    if (toolName === "complete_task") {
      return isError ? "Validation failed" : "Validated";
    }
    return isError ? "Failed" : "Done";
  };

  if (hasError) {
    return (
      <CollapsibleDetails
        label={getResultLabel(true)}
        icon="✗"
        variant="error"
        defaultOpen={true}
      >
        {result.error}
      </CollapsibleDetails>
    );
  }

  if (hasOutput) {
    return (
      <CollapsibleDetails
        label={getResultLabel(false)}
        icon="✓"
        variant="success"
      >
        {result.output}
      </CollapsibleDetails>
    );
  }

  return null;
}

function CompleteActivity({ success, message }) {
  return (
    <div
      className={cx(
        "text-sm font-medium flex items-center gap-1.5",
        success ? "text-slate-600" : "text-red-600"
      )}
    >
      <span>{success ? "✓" : "✗"}</span>
      <span>{message || (success ? "Task completed" : "Task failed")}</span>
    </div>
  );
}

function ErrorActivity({ message }) {
  return (
    <div className="text-sm text-red-600 flex items-center gap-1.5">
      <span>⚠</span>
      <span>{message}</span>
    </div>
  );
}

// ============================================================================
// Main Activity Renderer - uses ts-pattern for elegant matching
// ============================================================================

export function ActivityRenderer({ 
  activity, 
  isStreaming = false, 
  isPending = false,
  previousToolName = null 
}) {
  return match(activity)
    .with({ type: "thought" }, (a) => (
      <ThoughtActivity content={a.content} isStreaming={isStreaming} />
    ))
    .with({ type: "tool_call" }, (a) => (
      <ToolCallActivity name={a.name} args={a.args} isPending={isPending} />
    ))
    .with({ type: "tool_result" }, (a) => (
      <ToolResultActivity result={a.result} toolName={previousToolName} />
    ))
    .with({ type: "complete" }, (a) => (
      <CompleteActivity success={a.success} message={a.message} />
    ))
    .with({ type: "error" }, (a) => <ErrorActivity message={a.message} />)
    .with({ type: "turn_start" }, () => null) // Hide turn starts
    .exhaustive();
}

export default ActivityRenderer;
