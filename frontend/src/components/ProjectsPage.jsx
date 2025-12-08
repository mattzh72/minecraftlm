import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cva } from 'class-variance-authority';
import useSessionStore from '../store/sessionStore';
import ThumbnailViewer from './ThumbnailViewer';
import { SuggestionButtons } from './SuggestionButton';
import { PromptBox } from './PromptBox';

// Session card style
const sessionCard = cva([
  'bg-white rounded-2xl overflow-hidden cursor-pointer',
  'transition-all duration-200',
  'border border-slate-200/50 shadow-stacked',
  'hover:border-slate-300',
]);

export default function ProjectsPage() {
  const navigate = useNavigate();
  const createSession = useSessionStore((state) => state.createSession);

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

  // Handle creating a new session and navigating to it
  const handleSubmit = async (message) => {
    if (!message.trim() || isCreating) return;

    setIsCreating(true);
    const newSessionId = await createSession(message.trim());
    setInputValue('');
    setIsCreating(false);

    if (newSessionId) {
      navigate(`/session/${newSessionId}`);
    }
  };

  // Navigate to an existing session
  const handleSelectSession = (sessionId) => {
    navigate(`/session/${sessionId}`);
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

  return (
    <div className={`min-h-screen bg-slate-50 grid ${hasSessions ? 'grid-rows-[auto_1fr]' : 'grid-rows-1'}`}>
      {/* Hero Section with Chat Bar */}
      <div className={`flex flex-col items-center justify-center px-6 ${hasSessions ? 'py-20 pb-10' : 'min-h-screen py-10'}`}>
        <div className="w-full max-w-5xl flex flex-col items-center">
          <h1 className="text-5xl font-semibold text-slate-900 mb-4 tracking-tight">
            MinecraftLM
          </h1>
          <p className="text-lg text-slate-500 mb-12 font-normal text-center max-w-md">
            Design and export Minecraft schematics with natural language
          </p>

          {/* Chat Input */}
          <PromptBox
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            disabled={isCreating}
            isLoading={isCreating}
            placeholder="Describe what you want to build..."
            className="max-w-2xl shadow-stacked"
          >
            <PromptBox.Input maxRows={5} />
            <PromptBox.Submit />
          </PromptBox>

          <SuggestionButtons
            onSelect={(prompt) => setInputValue(prompt)}
            disabled={isCreating}
          />
        </div>
      </div>

      {/* Previous Sessions Section */}
      {!isLoading && hasSessions && (
        <div className="px-6 pb-16 flex justify-center items-start">
          <div className="w-full max-w-5xl">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-6 text-center">
              Recent Projects
            </h2>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
              {sessions.map(session => (
                <div
                  key={session.session_id}
                  onClick={() => handleSelectSession(session.session_id)}
                  className={sessionCard()}
                >
                  {/* Thumbnail */}
                  <div className="w-full h-44 bg-slate-100 flex items-center justify-center border-b border-slate-200">
                    {session.has_structure && sessionStructures[session.session_id] ? (
                      <ThumbnailViewer
                        structureData={sessionStructures[session.session_id]}
                        size={180}
                      />
                    ) : (
                      <div className="text-slate-300 text-5xl text-center">
                        📦
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="p-3.5">
                    <div className="flex justify-between items-center text-sm text-slate-500 mb-1.5">
                      <span>{session.message_count} messages</span>
                      {session.has_structure && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      )}
                    </div>

                    <div className="text-xs text-slate-400">
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
        <div className="flex-1 flex items-center justify-center p-12 text-slate-400 text-sm">
          Start building by typing in the chat above
        </div>
      )}
    </div>
  );
}
