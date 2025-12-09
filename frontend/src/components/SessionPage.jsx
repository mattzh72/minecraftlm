import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useSessionStore from "@/store/sessionStore";
import { useChatPanel } from "./ChatPanel";
import { MinecraftViewer } from "./MinecraftViewer";
import { Button } from "@/components/ui/button";
import { Card, CardPanel } from "@/components/ui/card";
import {
  Frame,
  FramePanel,
  FrameHeader,
  FrameTitle,
  FrameFooter,
} from "@/components/ui/frame";

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

  const { messages, input } = useChatPanel();

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
                      : sessionId
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
                      <p>WASD: Move camera</p>
                      <p>Shift/Space: Move up/down</p>
                    </CardPanel>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </div>
        <Frame className="w-md shrink-0 m-3 ml-0">
          <FrameHeader>
            <FrameTitle>Chat</FrameTitle>
          </FrameHeader>
          <FramePanel className="flex-1 min-h-0 flex flex-col p-0 overflow-clip">
            {messages}
          </FramePanel>
          <FrameFooter className="px-0 py-2">{input}</FrameFooter>
        </Frame>
      </div>
    </div>
  );
}
