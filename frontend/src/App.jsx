import { useState, useEffect } from 'react';
import useSessionStore from './store/sessionStore';
import ProjectsPage from './components/ProjectsPage';
import ChatPanel from './components/ChatPanel';
import MinecraftViewer from './components/MinecraftViewer';

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
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      <div className="relative flex-1">
        {/* Landing / Projects view */}
        <div
          className={`absolute inset-0 transition-all duration-400 ease-out ${showProjects
            ? 'opacity-100 pointer-events-auto translate-y-0'
            : 'opacity-0 pointer-events-none -translate-y-4'
            }`}
        >
          <ProjectsPage
            onSelectSession={handleSelectSession}
            onCreateNew={handleCreateNew}
          />
        </div>

        {/* Chat + Viewer view */}
        <div
          className={`absolute inset-0 flex min-h-0 transition-opacity duration-400 ease-out ${showProjects ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
            }`}
        >
          {/* Chat Panel Sidebar */}
          <div className="w-[420px] border-r border-gray-200 flex flex-col min-h-0 shrink-0 bg-gray-50">
            {/* Header with back button */}
            <div className="px-5 py-2.5 border-b border-gray-200 flex items-center gap-2.5">
              <button
                onClick={handleBackToProjects}
                className="px-3 py-1.5 bg-white text-gray-600 border border-gray-200 rounded-full cursor-pointer text-xs hover:bg-gray-50"
              >
                ← Projects
              </button>
              {sessionId && (
                <span className="text-xs text-gray-400 font-mono">
                  {sessionId.slice(0, 8)}...
                </span>
              )}
            </div>
            <ChatPanel />
          </div>

          {/* 3D Viewer Panel */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-gray-50">
            <div className="flex-1 w-full relative min-h-0">
              {structureData ? (
                <div className="absolute inset-0">
                  <MinecraftViewer />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-center text-gray-500 p-6">
                  <div>
                    <h2 className="mb-2">MinecraftLM</h2>
                    <p className="mb-4">
                      {isLoading
                        ? 'Loading session...'
                        : sessionId
                          ? 'Start chatting to design your Minecraft structure!'
                          : 'Initializing...'}
                    </p>
                    <p className="text-sm leading-relaxed">
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
