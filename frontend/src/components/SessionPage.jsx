import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useSessionStore from "../store/sessionStore";
import ChatPanel from "./ChatPanel";
import { MinecraftViewer } from "./MinecraftViewer";

/**
 * Session page - displays chat panel and 3D viewer for a specific session
 */
export function SessionPage() {
  const { sessionId: sessionIdParam } = useParams();
  const navigate = useNavigate();

  const sessionId = useSessionStore((state) => state.sessionId);
  const structureData = useSessionStore((state) => state.structureData);
  const isLoading = useSessionStore((state) => state.isLoading);
  const restoreSession = useSessionStore((state) => state.restoreSession);
  const resetSession = useSessionStore((state) => state.resetSession);

  // Restore session from URL param on mount
  useEffect(() => {
    if (sessionIdParam) {
      restoreSession(sessionIdParam);
    }
  }, [sessionIdParam, restoreSession]);

  const handleBackToProjects = () => {
    resetSession();
    navigate("/");
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 text-gray-900 overflow-hidden">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Chat Panel Sidebar */}
        <div className="w-sm border-r border-gray-200 flex flex-col min-h-0 shrink-0 bg-gray-50 overflow-hidden">
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
                      ? "Loading session..."
                      : sessionId
                      ? "Start chatting to design your Minecraft structure!"
                      : "Initializing..."}
                  </p>
                  <p className="text-sm leading-relaxed">
                    Controls:
                    <br />
                    • Mouse drag: Rotate view
                    <br />
                    • Scroll: Zoom in/out
                    <br />
                    • WASD: Move camera
                    <br />• Shift/Space: Move up/down
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
