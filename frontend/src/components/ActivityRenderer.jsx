import { cn } from "@/lib/utils";
import { BlockAnimation } from "./BlockAnimation.tsx";
import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsiblePanel,
} from "@/components/ui/collapsible";
import { Streamdown } from "streamdown";

function ShimmerText({ children }) {
  return (
    <span
      className={cn(
        "inline-block",
        "bg-linear-to-r from-muted-foreground via-foreground/50 to-muted-foreground",
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
    <div className="text-sm flex items-center gap-2 text-muted-foreground">
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
    <Collapsible defaultOpen={isStreaming}>
      <CollapsibleTrigger className="group flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left py-1">
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
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className="pl-4 border-l-2 border-border py-2">
          <div className="prose prose-sm prose-slate max-w-none max-h-64 overflow-y-auto text-muted-foreground text-xs dark:prose-invert">
            <Streamdown mode={isStreaming ? "streaming" : "static"}>
              {content}
            </Streamdown>
          </div>
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
