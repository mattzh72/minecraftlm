import { useState, useEffect } from 'react';
import { cva } from 'class-variance-authority';
import ThumbnailViewer from './ThumbnailViewer';
import { SuggestionButtons } from './SuggestionButton';

// Submit button variant based on input state
const submitButton = cva([
  'absolute right-2.5 top-1/2 -translate-y-1/2',
  'w-10 h-10 rounded-full border-none',
  'flex items-center justify-center',
  'transition-all duration-150',
], {
  variants: {
    active: {
      true: 'bg-gray-900 text-white cursor-pointer hover:bg-gray-700',
      false: 'bg-gray-200 text-gray-400 cursor-not-allowed',
    },
  },
});

// Session card style
const sessionCard = cva([
  'bg-white rounded-2xl overflow-hidden cursor-pointer',
  'transition-all duration-200',
  'border border-gray-200 shadow-sm',
  'hover:-translate-y-1 hover:shadow-lg hover:border-gray-300',
]);

export default function ProjectsPage({ onSelectSession, onCreateNew }) {
  const [sessions, setSessions] = useState([]);
  const [sessionStructures, setSessionStructures] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Fetch all sessions on mount
  useEffect(() => {
    fetch('/api/sessions')
      .then(res => res.json())
      .then(data => {
        const fetchedSessions = data.sessions || [];
        setSessions(fetchedSessions);
        setIsLoading(false);

        // Fetch structure data for sessions that have structures
        fetchedSessions.forEach(session => {
          if (session.has_structure) {
            fetch(`/api/sessions/${session.session_id}/structure`)
              .then(res => res.json())
              .then(structureData => {
                setSessionStructures(prev => ({
                  ...prev,
                  [session.session_id]: structureData,
                }));
              })
              .catch(err => {
                console.error(`Error fetching structure for ${session.session_id}:`, err);
              });
          }
        });
      })
      .catch(err => {
        console.error('Error fetching sessions:', err);
        setIsLoading(false);
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isCreating) return;

    setIsCreating(true);
    await onCreateNew(inputValue.trim());
    setInputValue('');
    setIsCreating(false);
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Unknown';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const hasSessions = sessions.length > 0;
  const isInputActive = inputValue.trim() && !isCreating;

  return (
    <div className={`min-h-screen bg-gray-50 grid ${hasSessions ? 'grid-rows-[auto_1fr]' : 'grid-rows-1'}`}>
      {/* Hero Section with Chat Bar */}
      <div className={`flex flex-col items-center justify-center px-6 ${hasSessions ? 'py-20 pb-10' : 'min-h-screen py-10'}`}>
        <div className="w-full max-w-5xl flex flex-col items-center">
          <h1 className="text-5xl font-semibold text-gray-900 mb-4 tracking-tight">
            MinecraftLM
          </h1>
          <p className="text-lg text-gray-500 mb-12 font-normal text-center max-w-md">
            Design and export Minecraft schematics with natural language
          </p>

          {/* Chat Input */}
          <form onSubmit={handleSubmit} className="w-full max-w-2xl">
            <div className="relative w-full">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Describe what you want to build..."
                disabled={isCreating}
                className="w-full py-4 pl-5 pr-16 text-base border border-gray-300 rounded-3xl outline-none bg-white text-gray-900 shadow-sm transition-all duration-150 focus:border-gray-400 focus:shadow-md disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!isInputActive}
                className={submitButton({ active: isInputActive })}
              >
                {isCreating ? (
                  <span className="text-xs text-gray-400">...</span>
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                )}
              </button>
            </div>
          </form>

          <SuggestionButtons
            onSelect={(prompt) => {
              setInputValue(prompt);
            }}
            disabled={isCreating}
          />
        </div>
      </div>

      {/* Previous Sessions Section */}
      {!isLoading && hasSessions && (
        <div className="px-6 pb-16 flex justify-center items-start">
          <div className="w-full max-w-5xl">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-6 text-center">
              Recent Projects
            </h2>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
              {sessions.map(session => (
                <div
                  key={session.session_id}
                  onClick={() => onSelectSession(session.session_id)}
                  className={sessionCard()}
                >
                  {/* Thumbnail */}
                  <div className="w-full h-44 bg-gray-100 flex items-center justify-center border-b border-gray-200">
                    {session.has_structure && sessionStructures[session.session_id] ? (
                      <ThumbnailViewer
                        structureData={sessionStructures[session.session_id]}
                        size={180}
                      />
                    ) : (
                      <div className="text-gray-300 text-5xl text-center">
                        📦
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="p-3.5">
                    <div className="flex justify-between items-center text-sm text-gray-500 mb-1.5">
                      <span>{session.message_count} messages</span>
                      {session.has_structure && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      )}
                    </div>

                    <div className="text-xs text-gray-400">
                      {formatDate(session.updated_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !hasSessions && (
        <div className="flex-1 flex items-center justify-center p-12 text-gray-400 text-sm">
          Start building by typing in the chat above
        </div>
      )}
    </div>
  );
}
