import { Sun, Sunset, Moon } from "lucide-react";
import { ToggleGroup, Toggle } from "@/components/ui/toggle-group";
import { useStore } from "@/store";
import type { TimeOfDay } from "@/config";

export function TimeOfDayToggle() {
  const timeOfDay = useStore((s) => s.timeOfDay);
  const setTimeOfDay = useStore((s) => s.setTimeOfDay);

  return (
    <ToggleGroup
      value={[timeOfDay]}
      onValueChange={(value) => {
        if (value.length > 0) {
          setTimeOfDay(value[0] as TimeOfDay);
        }
      }}
      className="bg-black/40 backdrop-blur-xl border border-white/15 rounded-lg p-0.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
    >
      <Toggle
        value="day"
        aria-label="Day"
        className="text-white/70 hover:text-white hover:bg-white/10 data-pressed:bg-white/20 data-pressed:text-white border-0"
      >
        <Sun className="size-4" />
      </Toggle>
      <Toggle
        value="sunset"
        aria-label="Sunset"
        className="text-white/70 hover:text-white hover:bg-white/10 data-pressed:bg-white/20 data-pressed:text-white border-0"
      >
        <Sunset className="size-4" />
      </Toggle>
      <Toggle
        value="night"
        aria-label="Night"
        className="text-white/70 hover:text-white hover:bg-white/10 data-pressed:bg-white/20 data-pressed:text-white border-0"
      >
        <Moon className="size-4" />
      </Toggle>
    </ToggleGroup>
  );
}
