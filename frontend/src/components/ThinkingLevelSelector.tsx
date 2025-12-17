import type { ThinkingLevel } from '@/lib/schemas';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';

const LEVELS: { value: ThinkingLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'med', label: 'Med' },
  { value: 'high', label: 'High' },
];

type ThinkingLevelSelectorProps = {
  variant?: 'default' | 'hero';
};

export function ThinkingLevelSelector({ variant = 'default' }: ThinkingLevelSelectorProps) {
  const level = useStore((s) => s.selectedThinkingLevel);
  const setLevel = useStore((s) => s.setSelectedThinkingLevel);

  const isLight = variant === 'hero';

  return (
    <div
      className={cn(
        'relative flex items-center gap-0.5 rounded-lg p-0.5 shrink-0 shadow-xs before:pointer-events-none before:absolute before:inset-0 before:rounded-lg',
        isLight
          ? 'bg-white/20 border border-black/10 before:shadow-[0_1px_--theme(--color-black/4%)]'
          : 'bg-black/70 border border-white/15 before:shadow-[0_-1px_--theme(--color-white/8%)]',
      )}
    >
      {LEVELS.map((l) => (
        <button
          key={l.value}
          type="button"
          onClick={() => setLevel(l.value)}
          className={cn(
            'px-2.5 py-1.5 text-xs rounded-md transition-all hover:cursor-pointer',
            isLight
              ? level === l.value
                ? 'bg-black/10 text-foreground/90'
                : 'text-foreground/70 hover:text-foreground/90 hover:bg-black/5'
              : level === l.value
              ? 'bg-white/10 text-white/90'
              : 'text-white/80 hover:text-white/90',
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
