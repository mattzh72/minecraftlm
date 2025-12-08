import { cn } from "../lib/cn";
import { BlockAnimation } from "./BlockAnimation.tsx";

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
