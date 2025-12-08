import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useSessionStore from "../store/sessionStore";
import ChatPanel from "./ChatPanel";
import { MinecraftViewer } from "./MinecraftViewer";

import { cn } from "../lib/cn";

/**
 * Session page - displays chat panel and 3D viewer for a specific session
 */
export function SessionPage() {
  const { sessionId: sessionIdParam } = useParams();
  const navigate = useNavigate();

  const sessionId = useSessionStore((state) => state.sessionId);
  const structureData = useSessionStore((state) => state.structureData);
  const previewBlocks = useSessionStore((state) => state.previewBlocks);
  const isLoading = useSessionStore((state) => state.isLoading);
  const restoreSession = useSessionStore((state) => state.restoreSession);
  const resetSession = useSessionStore((state) => state.resetSession);

  // Show viewer if we have structure data OR preview blocks
  const showViewer = structureData || previewBlocks.length > 0;

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
    <div className="h-screen flex flex-col text-slate-900 overflow-hidden">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="absolute top-4 left-4 z-10">
          <button
            onClick={handleBackToProjects}
            className={cn(
              "px-3 py-1.5",
              "bg-white text-slate-600 border border-slate-200 rounded-lg",
              "cursor-pointer text-xs font-medium",
              "hover:bg-slate-50 hover:border-slate-300 transition-colors"
            )}
          >
            ← Projects
          </button>
        </div>

        {/* 3D Viewer Panel */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="flex-1 w-full relative min-h-0">
            {showViewer ? (
              <div className="absolute inset-0">
                <MinecraftViewer />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-center text-slate-500 p-6">
                <div className="max-w-xs">
                  <h2 className="text-xl font-semibold text-slate-700 mb-3">
                    MinecraftLM
                  </h2>
                  <p className="mb-6 text-sm">
                    {isLoading
                      ? "Loading session..."
                      : sessionId
                      ? "Start chatting to design your Minecraft structure!"
                      : "Initializing..."}
                  </p>
                  <div className="text-xs text-slate-400 leading-relaxed bg-white rounded-xl p-4 border border-slate-200">
                    <p className="font-medium text-slate-500 mb-2">Controls</p>
                    <p>Mouse drag: Rotate view</p>
                    <p>Scroll: Zoom in/out</p>
                    <p>WASD: Move camera</p>
                    <p>Shift/Space: Move up/down</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div
          className={cn(
            "flex flex-col basis-md",
            "overflow-hidden m-3 rounded-2xl",
            "bg-slate-50",
            "border border-slate-400",
            "shadow-sm shadow-slate-900/5"
          )}
        >
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
