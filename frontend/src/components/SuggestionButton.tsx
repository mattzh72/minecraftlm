import { Button } from "@/components/ui/button";
import { useStore } from "@/store";

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
      className="gap-2"
    >
      <span className="text-base">{emoji}</span>
      <span>{label}</span>
    </Button>
  );
}

type SuggestionButtonsProps = {
  disabled: boolean;
};
export function SuggestionButtons({ disabled }: SuggestionButtonsProps) {
  const setDraftMessage = useStore((s) => s.setDraftMessage);

  return (
    <div className="flex flex-wrap gap-2.5 justify-center mt-5">
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
