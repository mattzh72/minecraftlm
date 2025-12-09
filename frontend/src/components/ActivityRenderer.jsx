import { cn } from "../lib/cn";
import { BlockAnimation } from "./BlockAnimation.tsx";
import { ChevronDown } from "lucide-react";
import { Collapsible } from "@base-ui-components/react/collapsible";
import { Streamdown } from "streamdown";

function ShimmerText({ children }) {
  return (
    <span
      className={cn(
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

export function ThinkingIndicator() {
  return (
    <div className="text-sm flex items-center gap-2 text-slate-500">
      <BlockAnimation size={12} />
      <ShimmerText>Thinking</ShimmerText>
    </div>
  );
}

/**
 * Displays thought content in a collapsible accordion
 * Shows streaming indicator when thoughts are actively being received
 */
export function ThoughtDisplay({ content, isStreaming }) {
  if (!content || !content.trim()) return null;

  return (
    <Collapsible.Root defaultOpen={false}>
      <Collapsible.Trigger className="group flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-500 transition-colors cursor-pointer w-full text-left py-1">
        <ChevronDown
          size={12}
          className="transition-transform shrink-0 group-data-[panel-open]:rotate-180"
        />
        <span className="flex items-center gap-1.5 min-w-0">
          {isStreaming && <BlockAnimation size={10} />}
          <span className={cn(isStreaming && "animate-pulse")}>
            Thought process
          </span>
        </span>
      </Collapsible.Trigger>
      <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 ease-out data-[starting-style]:h-0 data-[ending-style]:h-0">
        <div className="pl-4 border-l-2 border-slate-200 py-2">
          <div className="prose prose-sm prose-slate max-w-none max-h-64 overflow-y-auto text-slate-500 text-xs">
            <Streamdown mode={isStreaming ? "streaming" : "static"}>
              {content}
            </Streamdown>
          </div>
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
