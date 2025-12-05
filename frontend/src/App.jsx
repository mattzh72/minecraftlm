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
    const newSessionId = await createSession();

    // Store initial message in sessionStorage if provided
    if (initialMessage && newSessionId) {
      sessionStorage.setItem(`initial_message_${newSessionId}`, initialMessage);
    }
  };

  const handleBackToProjects = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('session');
    window.history.pushState({}, '', url);
    resetSession();
    setShowProjects(true);
  };

  // Show projects page
  if (showProjects && !sessionId) {
    return (
      <ProjectsPage
        onSelectSession={handleSelectSession}
        onCreateNew={handleCreateNew}
      />
    );
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: '#1a1a1a',
      color: '#e0e0e0',
      overflow: 'hidden',
    }}>
      <div style={{
        width: '400px',
        borderRight: '1px solid #333',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          padding: '10px 20px',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <button
            onClick={handleBackToProjects}
            style={{
              padding: '6px 12px',
              backgroundColor: '#333',
              color: '#888',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            ← Projects
          </button>
          {sessionId && (
            <span style={{ fontSize: '11px', color: '#555', fontFamily: 'monospace' }}>
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
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0a0a0a',
      }}>
        {structureData ? (
          <MinecraftViewer />
        ) : (
          <div style={{
            textAlign: 'center',
            color: '#666',
          }}>
            <h2>MinecraftLM</h2>
            <p>
              {isLoading
                ? 'Loading session...'
                : sessionId
                  ? 'Start chatting to design your Minecraft structure!'
                  : 'Initializing...'}
            </p>
            <p style={{ fontSize: '0.9em', marginTop: '20px' }}>
              Controls:<br />
              • Mouse drag: Rotate view<br />
              • Scroll: Zoom in/out<br />
              • WASD: Move camera<br />
              • Shift/Space: Move up/down
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
