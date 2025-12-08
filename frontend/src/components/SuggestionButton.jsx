import { cva } from 'class-variance-authority';

const SUGGESTIONS = [
    { emoji: '🏠', label: 'Dorm Room', prompt: 'Build a cozy college dorm room' },
    { emoji: '🚀', label: 'Spaceship', prompt: 'Build a futuristic spaceship' },
    { emoji: '🏰', label: 'Medieval Castle', prompt: 'Build a medieval castle' },
    { emoji: '🌳', label: 'Treehouse', prompt: 'Build a treehouse' },
];

const suggestionButton = cva([
    'inline-flex items-center gap-2 px-4 py-2.5',
    'text-sm font-medium bg-white border rounded-3xl',
    'transition-all duration-150 shadow-sm',
    // Hover states
    'hover:text-gray-900 hover:bg-gray-100 hover:border-gray-300',
    'hover:-translate-y-0.5 hover:shadow-md',
    // Disabled states
    'disabled:cursor-not-allowed disabled:opacity-50',
    'disabled:hover:translate-y-0 disabled:hover:bg-white',
    'disabled:hover:border-gray-200 disabled:hover:shadow-sm',
], {
    variants: {
        intent: {
            default: 'text-gray-600 border-gray-200 cursor-pointer',
        },
    },
    defaultVariants: {
        intent: 'default',
    },
});

export function SuggestionButton({ emoji, label, onClick, disabled }) {
    return (
        <button
            className={suggestionButton()}
            onClick={onClick}
            disabled={disabled}
        >
            <span className="text-base">{emoji}</span>
            <span>{label}</span>
        </button>
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
