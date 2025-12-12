import { Button } from "@/components/ui/button";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  { emoji: "🏠", label: "Dorm Room", prompt: "Build a cozy college dorm room" },
  { emoji: "🚀", label: "Spaceship", prompt: "Build a futuristic spaceship" },
  { emoji: "🏰", label: "Medieval Castle", prompt: "Build a medieval castle" },
  { emoji: "🌳", label: "Treehouse", prompt: "Build a treehouse" },
];

type SuggestionButtonProps = {
  emoji: string;
  label: string;
  onClick: () => void;
  disabled: boolean;
};
export function SuggestionButton({
  emoji,
  label,
  onClick,
  disabled,
}: SuggestionButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "gap-2.5 px-4 py-2",
        "bg-white/50 hover:bg-white/70",
        "backdrop-blur-sm",
        "border-white/40 hover:border-white/60",
        "shadow-sm hover:shadow-md",
        "transition-all duration-200 transition-spring-soft",
        "hover:-translate-y-0.5",
        "active:translate-y-0 active:scale-[0.98]"
      )}
    >
      <span className="text-base">{emoji}</span>
      <span className="text-muted-foreground/90">{label}</span>
    </Button>
  );
}

type SuggestionButtonsProps = {
  disabled: boolean;
};
export function SuggestionButtons({ disabled }: SuggestionButtonsProps) {
  const setDraftMessage = useStore((s) => s.setDraftMessage);

  return (
    <div className="flex flex-wrap gap-3 justify-center mt-8">
      {SUGGESTIONS.map((suggestion) => (
        <SuggestionButton
          key={suggestion.label}
          emoji={suggestion.emoji}
          label={suggestion.label}
          onClick={() => {
            setDraftMessage(suggestion.prompt);
          }}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
