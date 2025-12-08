import { Box } from "lucide-react";
import { cn } from "../lib/cn";

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
    <div className="text-sm flex items-center gap-1.5 text-slate-500">
      <Box size={14} className="animate-spin" />
      <ShimmerText>Thinking</ShimmerText>
    </div>
  );
}
