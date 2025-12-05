import { useState, useEffect, useRef } from 'react';
import ThumbnailViewer from './ThumbnailViewer';

const PLACEHOLDERS = [
  'Build a medieval castle...',
  'Build a modern house...',
  'Build a treehouse...',
  'Build a pyramid...',
  'Build a spaceship...',
  'Build a lighthouse...',
];

const COMMON_PREFIX = 'Build a ';

export default function ProjectsPage({ onSelectSession, onCreateNew }) {
  const [sessions, setSessions] = useState([]);
  const [sessionStructures, setSessionStructures] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [placeholderText, setPlaceholderText] = useState(COMMON_PREFIX);
  const placeholderIndexRef = useRef(0);
  const isDeletingRef = useRef(false);
  const timeoutRef = useRef(null);
  const placeholderTextRef = useRef(COMMON_PREFIX);

  // Typewriter effect for placeholder
  useEffect(() => {
    const typingSpeed = 80;
    const deletingSpeed = 30;
    const pauseAfterComplete = 2000;

    const runTypewriter = () => {
      const currentFullText = PLACEHOLDERS[placeholderIndexRef.current];
      const currentText = placeholderTextRef.current;

      let nextText = currentText;
      let nextIsDeleting = isDeletingRef.current;
      let nextIndex = placeholderIndexRef.current;
      let delay;

      if (!isDeletingRef.current) {
        if (currentText.length < currentFullText.length) {
          nextText = currentFullText.slice(0, currentText.length + 1);
          delay = typingSpeed;
        } else {
          nextIsDeleting = true;
          delay = pauseAfterComplete;
        }
      } else {
        if (currentText.length > COMMON_PREFIX.length) {
          nextText = currentText.slice(0, -1);
          delay = deletingSpeed;
        } else {
          nextIsDeleting = false;
          nextIndex = (placeholderIndexRef.current + 1) % PLACEHOLDERS.length;
          delay = typingSpeed;
        }
      }

      isDeletingRef.current = nextIsDeleting;
      placeholderIndexRef.current = nextIndex;
      placeholderTextRef.current = nextText;
      setPlaceholderText(nextText);

      timeoutRef.current = setTimeout(runTypewriter, delay);
    };

    timeoutRef.current = setTimeout(runTypewriter, typingSpeed);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Fetch all sessions
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

  return (
    <div style={{
      minHeight: '100vh',
      background: '#fafafa',
      display: 'grid',
      gridTemplateRows: sessions.length === 0 ? '1fr' : 'auto 1fr',
      padding: '0',
    }}>
      {/* Hero Section with Chat Bar */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: sessions.length === 0 ? 'clamp(40px, 10vh, 80px)' : 'clamp(80px, 15vh, 140px) clamp(24px, 5vw, 80px) clamp(40px, 8vh, 80px)',
        minHeight: sessions.length === 0 ? '100vh' : '0',
      }}>
        <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1 style={{
            fontSize: '52px',
            fontWeight: '600',
            color: '#1a1a1a',
            marginBottom: '16px',
            letterSpacing: '-1px',
          }}>
            MinecraftLM
          </h1>
          <p style={{
            fontSize: '17px',
            color: '#6b6b6b',
            marginBottom: '48px',
            fontWeight: '400',
            textAlign: 'center',
            maxWidth: '500px',
          }}>
            Design and export Minecraft schematics with natural language
          </p>

          {/* Chat Input */}
          <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '700px' }}>
          <div style={{
            position: 'relative',
            width: '100%',
          }}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholderText}
              disabled={isCreating}
              style={{
                width: '100%',
                padding: '18px 64px 18px 20px',
                fontSize: '16px',
                border: '1px solid #d1d1d1',
                borderRadius: '26px',
                outline: 'none',
                backgroundColor: '#ffffff',
                color: '#1a1a1a',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.02), 0 2px 8px rgba(0,0,0,0.06)',
                transition: 'all 0.15s ease',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#a0a0a0';
                e.target.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.08)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d1d1';
                e.target.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.02), 0 2px 8px rgba(0,0,0,0.06)';
              }}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isCreating}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: inputValue.trim() && !isCreating ? '#1a1a1a' : '#e5e5e5',
                color: 'white',
                cursor: inputValue.trim() && !isCreating ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
                padding: '0',
              }}
              onMouseEnter={(e) => {
                if (inputValue.trim() && !isCreating) {
                  e.currentTarget.style.backgroundColor = '#2f2f2f';
                }
              }}
              onMouseLeave={(e) => {
                if (inputValue.trim() && !isCreating) {
                  e.currentTarget.style.backgroundColor = '#1a1a1a';
                }
              }}
            >
              {isCreating ? (
                <span style={{ fontSize: '12px', color: '#999' }}>...</span>
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
        </div>
      </div>

      {/* Previous Sessions Section */}
      {!isLoading && sessions.length > 0 && (
        <div style={{
          padding: `0 clamp(24px, 5vw, 80px) clamp(60px, 10vh, 100px)`,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}>
          <div style={{ width: '100%', maxWidth: '1200px' }}>
            <h2 style={{
              fontSize: '13px',
              fontWeight: '600',
              color: '#a0a0a0',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '24px',
              textAlign: 'center',
            }}>
              Recent Projects
            </h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '20px',
            }}>
              {sessions.map(session => (
                <div
                  key={session.session_id}
                  onClick={() => onSelectSession(session.session_id)}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '1px solid #e8e8e8',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.08)';
                    e.currentTarget.style.borderColor = '#d0d0d0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.04)';
                    e.currentTarget.style.borderColor = '#e8e8e8';
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{
                    width: '100%',
                    height: '180px',
                    backgroundColor: '#f8f8f8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: '1px solid #ececec',
                  }}>
                    {session.has_structure && sessionStructures[session.session_id] ? (
                      <ThumbnailViewer
                        structureData={sessionStructures[session.session_id]}
                        size={180}
                      />
                    ) : (
                      <div style={{
                        color: '#d0d0d0',
                        fontSize: '48px',
                        textAlign: 'center',
                      }}>
                        📦
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div style={{ padding: '14px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '13px',
                      color: '#6b6b6b',
                      marginBottom: '6px',
                    }}>
                      <span>{session.message_count} messages</span>
                      {session.has_structure && (
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: '#10b981',
                        }}></span>
                      )}
                    </div>

                    <div style={{
                      fontSize: '11px',
                      color: '#a0a0a0',
                    }}>
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
      {!isLoading && sessions.length === 0 && (
        <div style={{
          flex: '1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          color: '#a0a0a0',
          fontSize: '14px',
        }}>
          Start building by typing in the chat above
        </div>
      )}
    </div>
  );
}
