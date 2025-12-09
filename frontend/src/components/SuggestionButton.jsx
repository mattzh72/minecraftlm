import { Button } from "@/components/ui/button";

const SUGGESTIONS = [
  { emoji: '🏠', label: 'Dorm Room', prompt: 'Build a cozy college dorm room' },
  { emoji: '🚀', label: 'Spaceship', prompt: 'Build a futuristic spaceship' },
  { emoji: '🏰', label: 'Medieval Castle', prompt: 'Build a medieval castle' },
  { emoji: '🌳', label: 'Treehouse', prompt: 'Build a treehouse' },
];

export function SuggestionButton({ emoji, label, onClick, disabled }) {
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

export function SuggestionButtons({ onSelect, disabled }) {
  return (
    <div className="flex flex-wrap gap-2.5 justify-center mt-5">
      {SUGGESTIONS.map((suggestion) => (
        <SuggestionButton
          key={suggestion.label}
          emoji={suggestion.emoji}
          label={suggestion.label}
          onClick={() => onSelect(suggestion.prompt)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
