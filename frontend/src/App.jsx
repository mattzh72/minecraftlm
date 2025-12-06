import { useState, useEffect } from 'react';
import useSessionStore from './store/sessionStore';
import ProjectsPage from './components/ProjectsPage';
import ChatPanel from './components/ChatPanel';
import MinecraftViewer from './components/MinecraftViewer';
import './App.css';

function App() {
  const sessionId = useSessionStore((state) => state.sessionId);
  const structureData = useSessionStore((state) => state.structureData);
  const isLoading = useSessionStore((state) => state.isLoading);
  const restoreSession = useSessionStore((state) => state.restoreSession);
  const createSession = useSessionStore((state) => state.createSession);
  const resetSession = useSessionStore((state) => state.resetSession);

  const [showProjects, setShowProjects] = useState(true);

  // Check URL on mount
  useEffect(() => {
    const url = new URL(window.location.href);
    const sessionFromUrl = url.searchParams.get('session');
    if (sessionFromUrl) {
      setShowProjects(false);
      restoreSession(sessionFromUrl);
    }
  }, [restoreSession]);

  const handleSelectSession = (id) => {
    const url = new URL(window.location.href);
    url.searchParams.set('session', id);
    window.history.pushState({}, '', url);
    setShowProjects(false);
    restoreSession(id);
  };

  const handleCreateNew = async (initialMessage = null) => {
    setShowProjects(false);
    await createSession(initialMessage || undefined);
  };

  const handleBackToProjects = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('session');
    window.history.pushState({}, '', url);
    resetSession();
    setShowProjects(true);
  };

  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
      backgroundColor: '#fafafa',
      color: '#1a1a1a',
    }}>
      <div style={{
        position: 'relative',
        height: '100%',
        overflow: 'hidden',
      }}>
        {/* Landing / Projects view */}
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: showProjects ? 1 : 0,
          pointerEvents: showProjects ? 'auto' : 'none',
          transform: showProjects ? 'translateY(0px)' : 'translateY(-16px)',
          transition: 'opacity 0.4s ease, transform 0.4s ease',
        }}>
          <ProjectsPage
            onSelectSession={handleSelectSession}
            onCreateNew={handleCreateNew}
          />
        </div>

        {/* Chat + Viewer view */}
        <div style={{
          position: 'absolute',
          inset: 0,
          height: '100%',
          display: 'flex',
          opacity: showProjects ? 0 : 1,
          pointerEvents: showProjects ? 'none' : 'auto',
          transition: 'opacity 0.4s ease',
        }}>
          <div style={{
            width: '420px',
            borderRight: '1px solid #e5e5e5',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
            backgroundColor: '#fafafa',
          }}>
            <div style={{
              padding: '10px 20px',
              borderBottom: '1px solid #e5e5e5',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <button
                onClick={handleBackToProjects}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#ffffff',
                  color: '#4b5563',
                  border: '1px solid #e5e5e5',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                ← Projects
              </button>
              {sessionId && (
                <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>
                  {sessionId.slice(0, 8)}...
                </span>
              )}
            </div>
            <ChatPanel />
          </div>

          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            backgroundColor: '#fafafa',
          }}>
            <div style={{ flex: 1, width: '100%', height: '100%', position: 'relative', minHeight: 0 }}>
              {structureData ? (
                <div style={{ position: 'absolute', inset: 0 }}>
                  <MinecraftViewer />
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  textAlign: 'center',
                  color: '#6b7280',
                  padding: '24px',
                }}>
                  <div>
                    <h2 style={{ marginBottom: '8px' }}>MinecraftLM</h2>
                    <p style={{ marginBottom: '16px' }}>
                      {isLoading
                        ? 'Loading session...'
                        : sessionId
                          ? 'Start chatting to design your Minecraft structure!'
                          : 'Initializing...'}
                    </p>
                    <p style={{ fontSize: '0.9em', lineHeight: 1.6 }}>
                      Controls:<br />
                      • Mouse drag: Rotate view<br />
                      • Scroll: Zoom in/out<br />
                      • WASD: Move camera<br />
                      • Shift/Space: Move up/down
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
