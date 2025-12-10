import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChatPanel } from "./ChatPanel";
import { useSession } from "@/hooks/useSession";
import { MinecraftViewer } from "./MinecraftViewer";
import { Button } from "@/components/ui/button";
import { Card, CardPanel } from "@/components/ui/card";
import { useStore } from "@/store";
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
    <div className="h-screen flex flex-col text-foreground overflow-hidden">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="absolute top-4 left-4 z-10">
          <Button variant="outline" size="sm" onClick={handleBackToProjects}>
            ← Projects
          </Button>
        </div>

        {/* 3D Viewer Panel */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="flex-1 w-full relative min-h-0">
            {structureData ? (
              <div className="absolute inset-0">
                <MinecraftViewer />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-center text-muted-foreground p-6">
                <div className="max-w-xs">
                  <h2 className="text-xl font-semibold text-foreground mb-3">
                    MinecraftLM
                  </h2>
                  <p className="mb-6 text-sm">
                    {isLoading
                      ? "Loading session..."
                      : activeSessionId
                      ? "Start chatting to design your Minecraft structure!"
                      : "Initializing..."}
                  </p>
                  <Card className="text-xs leading-relaxed p-4">
                    <CardPanel className="p-0">
                      <p className="font-medium text-muted-foreground mb-2">
                        Controls
                      </p>
                      <p>Mouse drag: Rotate view</p>
                      <p>Scroll: Zoom in/out</p>
                      <p>Shift/Space: Move up/down</p>
                    </CardPanel>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </div>

        <ChatPanel />
      </div>
    </div>
  );
}
