import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";
import { useStore } from "@/store";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BlockAnimation } from "./BlockAnimation";
import { ChatPanel } from "./ChatPanel";
import { MinecraftViewer } from "./MinecraftViewer";
import { TimeOfDayToggle } from "./TimeOfDayToggle";
import { ViewerModeToggle } from "./ViewerModeToggle";
/**
 * Session page - displays chat panel and 3D viewer for a specific session
 */

// Example of extracting the session ID from the URL:
// http://localhost:5173/session/09b9a328-2354-415e-a48a-ea6541a90e65
const useSessionIdFromUrl = () => {
  // Matches the "/session/:sessionId" route
  const { sessionId } = useParams<{ sessionId: string }>();
  return sessionId;
};

export function SessionPage() {
  const navigate = useNavigate();
  const activeSessionId = useStore((s) => s.activeSessionId);
  const { isLoading, restoreSession, clearActiveSession } = useSession();
  const urlSessionId = useSessionIdFromUrl();

  const [chatExpanded, setChatExpanded] = useState(true);
  const [chatWidth, setChatWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);

  // restore session from URL param on mount
  useEffect(() => {
    if (urlSessionId) {
      restoreSession(urlSessionId);
    }
  }, []);

  // Restore session from URL param on mount
  useEffect(() => {
    console.log(`useEffect`, { activeSessionId });
    if (urlSessionId) {
      restoreSession(urlSessionId);
    }
  }, [urlSessionId, restoreSession]);

  const handleBackToProjects = () => {
    clearActiveSession();
    navigate("/");
  };
  const sessions = useStore((s) => s.sessions);

  const activeSession = useMemo(() => {
    return activeSessionId ? sessions[activeSessionId] : null;
  }, [activeSessionId, sessions]);

  const structureData = useMemo(() => {
    return activeSession?.structure || null;
  }, [activeSession]);
  console.log(`[SessionPage] structureData`, structureData);

  return (
    <div className="h-screen w-screen relative overflow-hidden">
      {/* 3D Viewer - Full screen background, extended left to center content accounting for chat panel */}
      <div
        className="absolute inset-y-0 right-0"
        style={{ left: "-320px" }}
      >
        {structureData ? (
          <MinecraftViewer />
        ) : (
          <div className="flex items-center justify-center h-full text-center text-white/70 p-6 bg-gradient-to-b from-zinc-700 to-zinc-900">
            <div className="max-w-xs">
              <div className="flex justify-center mb-4">
                <BlockAnimation size={32} className="text-white/90" />
              </div>
              <h2 className="text-xl font-semibold text-white/90 mb-3">
                MinecraftLM
              </h2>
              <p className="mb-6 text-sm text-white/60">
                {isLoading
                  ? "Loading session..."
                  : activeSessionId
                    ? "Rendering your structure..."
                    : "Initializing..."}
              </p>
              <div className="bg-white/10 rounded-xl text-xs leading-relaxed p-4 text-white/70">
                <p className="font-medium text-white/80 mb-2">
                  Controls
                </p>
                <div className="flex flex-col items gap-1 text-center">
                  <p>Mouse drag: Rotate view</p>
                  <p>Scroll: Zoom in/out</p>
                  <p>Shift/Space: Move up/down</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating back button - dark glass treatment */}
      <div className="absolute top-4 left-4 z-20">
        <Button
          variant="outline"
          size="sm"
          onClick={handleBackToProjects}
          className="bg-black/40 border-white/15 text-white/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] backdrop-blur-xl hover:bg-black/50 hover:text-white"
        >
          ← Projects
        </Button>
      </div>

      {/* Time of day toggle */}
      <div className="absolute top-16 left-4 z-20">
        <TimeOfDayToggle />
      </div>

      {/* Viewer mode toggle */}
      <div className="absolute top-28 left-4 z-20">
        <ViewerModeToggle />
      </div>

      {/* Floating Chat Panel - glass overlay, collapses vertically */}
      <div
        className={`absolute top-4 right-4 z-10 ${!isResizing ? 'transition-all duration-300 ease-in-out' : ''}`}
        style={{
          width: chatWidth,
          height: chatExpanded ? 'calc(100% - 32px)' : 48
        }}
      >
        <ChatPanel
          expanded={chatExpanded}
          setExpanded={setChatExpanded}
          width={chatWidth}
          onWidthChange={setChatWidth}
          onResizeStart={() => setIsResizing(true)}
          onResizeEnd={() => setIsResizing(false)}
        />
      </div>
    </div>
  );
}
