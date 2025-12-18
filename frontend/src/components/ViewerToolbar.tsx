import { Toggle, ToggleGroup } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { TimeOfDay } from "@/config";
import type { ViewerMode } from "@/store";
import { useStore } from "@/store";
import { Eye, Footprints, Moon, Sun, Sunset } from "lucide-react";

const VIEWER_MODES: { value: ViewerMode; icon: typeof Eye }[] = [
  { value: "orbit", icon: Eye },
  { value: "playable", icon: Footprints },
];

export function ViewerToolbar() {
  const timeOfDay = useStore((s) => s.timeOfDay);
  const setTimeOfDay = useStore((s) => s.setTimeOfDay);
  const viewerMode = useStore((s) => s.viewerMode);
  const setViewerMode = useStore((s) => s.setViewerMode);

  const iconToggleClassName =
    "text-white/70 hover:text-white hover:bg-white/10 data-pressed:bg-white/20 data-pressed:text-white border-0 rounded-md px-2.5 py-2";

  return (
    <div className="bg-black/50 backdrop-blur-xl border border-white/15 rounded-xl p-1.5 shadow-lg shadow-black/20 flex items-center gap-2">
      {/* Separator */}

      {/* Time of Day Group - icon style */}
      <ToggleGroup
        value={[timeOfDay]}
        onValueChange={(value) => {
          if (value.length > 0) {
            setTimeOfDay(value[0] as TimeOfDay);
          }
        }}
        className="gap-0.5"
      >
        <Toggle value="day" aria-label="Day" className={iconToggleClassName}>
          <Sun className="size-4" />
        </Toggle>
        <Toggle
          value="sunset"
          aria-label="Sunset"
          className={iconToggleClassName}
        >
          <Sunset className="size-4" />
        </Toggle>
        <Toggle
          value="night"
          aria-label="Night"
          className={iconToggleClassName}
        >
          <Moon className="size-4" />
        </Toggle>
      </ToggleGroup>

      <div className="w-px h-5 bg-white/15" />

      <div className="relative flex items-center gap-0.5 rounded-lg p-0.5 shrink-0 shadow-xs bg-black/70 border border-white/15 before:pointer-events-none before:absolute before:inset-0 before:rounded-lg before:shadow-[0_-1px_--theme(--color-white/8%)]">
        {VIEWER_MODES.map((mode) => {
          const Icon = mode.icon;
          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => setViewerMode(mode.value)}
              className={cn(
                "p-2 rounded-md transition-all hover:cursor-pointer",
                viewerMode === mode.value
                  ? "bg-white/10 text-white/90"
                  : "text-white/70 hover:text-white/90"
              )}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
