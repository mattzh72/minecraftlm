import { useState, useCallback, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/group";
import { ScrollArea } from "@/components/ui/scroll-area";

type AgentScrollerProps = {
  children: React.ReactNode;
  className?: string;
  autoScrollDeps?: unknown[];
};

/**
 * A scrollable container with scroll masks and jump buttons.
 * Designed for chat/agent message lists with auto-scroll on new content.
 */
export function AgentScroller({
  children,
  className,
  autoScrollDeps = [],
}: AgentScrollerProps) {
  const [showTopMask, setShowTopMask] = useState(false);
  const [showBottomMask, setShowBottomMask] = useState(false);

  const scrollEndRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.target as HTMLDivElement | null;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const threshold = 100;

    setShowTopMask(scrollTop > threshold);
    setShowBottomMask(scrollTop < scrollHeight - clientHeight - threshold);
  }, []);

  // Auto-scroll to bottom when deps change
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, autoScrollDeps);

  const scrollToTop = useCallback(() => {
    viewportRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const scrollToBottom = useCallback(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Only show buttons when away from BOTH edges
  const showJumpButtons = showTopMask && showBottomMask;

  return (
    <div className={cn("relative h-full", className)}>
      {/* Scrollable content using COSS ScrollArea */}
      <ScrollArea
        orientation="vertical"
        onScroll={handleScroll}
        viewportRef={viewportRef}
        className="px-3 py-2"
      >
        <div className="space-y-2">
          {children}
          <div ref={scrollEndRef} />
        </div>
      </ScrollArea>

      {/* Jump button group */}
      <ButtonGroup
        orientation="vertical"
        className={cn(
          "absolute bottom-3 right-3 z-50 transition-all duration-200",
          showJumpButtons
            ? "opacity-100 scale-100"
            : "opacity-0 scale-90 pointer-events-none"
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
  );
}
