import './SuggestionButton.css';

const SUGGESTIONS = [
    { emoji: '🏠', label: 'Dorm Room', prompt: 'Build a cozy college dorm room' },
    { emoji: '🚀', label: 'Spaceship', prompt: 'Build a futuristic spaceship' },
    { emoji: '🏰', label: 'Medieval Castle', prompt: 'Build a medieval castle' },
    { emoji: '🌳', label: 'Treehouse', prompt: 'Build a treehouse' },
];

export function SuggestionButton({ emoji, label, onClick, disabled }) {
    return (
        <button
            className="suggestion-button"
            onClick={onClick}
            disabled={disabled}
        >
            <span className="suggestion-button__emoji">{emoji}</span>
            <span>{label}</span>
        </button>
    );
}

export function SuggestionButtons({ onSelect, disabled }) {
    return (
        <div className="suggestion-buttons">
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

export default SuggestionButtons;
