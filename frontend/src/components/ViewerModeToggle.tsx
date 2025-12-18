import { Toggle, ToggleGroup } from '@/components/ui/toggle-group';
import type { ViewerMode } from '@/store';
import { useStore } from '@/store';
import { Eye, Footprints } from 'lucide-react';

export function ViewerModeToggle() {
  const viewerMode = useStore((s) => s.viewerMode);
  const setViewerMode = useStore((s) => s.setViewerMode);

  return (
    <ToggleGroup
      value={[viewerMode]}
      onValueChange={(value) => {
        if (value.length > 0) {
          setViewerMode(value[0] as ViewerMode);
        }
      }}
      className="bg-black/40 backdrop-blur-xl border border-white/15 rounded-lg p-1 gap-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]"
    >
      <Toggle
        value="orbit"
        aria-label="Orbit Mode"
        className="text-white/70 hover:text-white hover:bg-white/10 data-pressed:bg-white/20 data-pressed:text-white border-0 rounded-md"
      >
        <Eye className="size-4" />
      </Toggle>
      <Toggle
        value="playable"
        aria-label="Playable Mode"
        className="text-white/70 hover:text-white hover:bg-white/10 data-pressed:bg-white/20 data-pressed:text-white border-0 rounded-md"
      >
        <Footprints className="size-4" />
      </Toggle>
    </ToggleGroup>
  );
}
