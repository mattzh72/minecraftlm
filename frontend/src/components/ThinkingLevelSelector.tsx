import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import type { ThinkingLevel } from "@/lib/schemas";

const LEVELS: { value: ThinkingLevel; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "med", label: "Med" },
  { value: "high", label: "High" },
];

export function ThinkingLevelSelector() {
  const level = useStore((s) => s.selectedThinkingLevel);
  const setLevel = useStore((s) => s.setSelectedThinkingLevel);

  return (
    <div className="flex items-center gap-0.5 bg-black/30 rounded-lg p-0.5 border border-white/10 shrink-0">
      {LEVELS.map((l) => (
        <button
          key={l.value}
          type="button"
          onClick={() => setLevel(l.value)}
          className={cn(
            "px-2 py-1 text-xs rounded-md transition-all",
            level === l.value
              ? "bg-white/20 text-white/90"
              : "text-white/50 hover:text-white/70"
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
