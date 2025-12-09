import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useSessionStore from "@/store/sessionStore";
import useModelStore from "@/store/modelStore";
import { useChat, ChatPanel } from "./ChatPanel";
import { AgentScroller } from "./AgentScroller";
import { PromptBox } from "./PromptBox";
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
import useInitialMessage from "@/hooks/useInitialMessage";

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

  const setSelectedModel = useModelStore((state) => state.setSelectedModel);

  // Restore session from URL param on mount
  useEffect(() => {
    if (sessionIdParam) {
      restoreSession(sessionIdParam, setSelectedModel);
    }
  }, [sessionIdParam, restoreSession, setSelectedModel]);

  const handleBackToProjects = () => {
    resetSession();
    navigate("/");
  };

  const {
    sessionId: chatSessionId,
    input,
    setInput,
    isLoading: chatIsLoading,
    displayMessages,
    pendingUserMessage,
    streamingThought,
    streamingText,
    chatState,
    error,
    handleSend,
  } = useChat();

  useInitialMessage(
    chatSessionId,
    displayMessages.length,
    chatIsLoading,
    handleSend
  );

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

        <Frame className="w-md shrink-0 my-3 mr-3 max-h-[calc(100%-1.5rem)]">
          <FrameHeader>
            <FrameTitle>Chat</FrameTitle>
          </FrameHeader>
          <FramePanel className="flex-1 min-h-0 p-0 overflow-clip">
            <AgentScroller
              autoScrollDeps={[
                displayMessages,
                pendingUserMessage,
                streamingThought,
                streamingText,
                chatState,
              ]}
            >
              <ChatPanel.Messages
                messages={displayMessages}
                pendingUserMessage={pendingUserMessage}
                streamingThought={streamingThought}
                streamingText={streamingText}
                chatState={chatState}
                error={error}
                isLoading={chatIsLoading}
              />
            </AgentScroller>
          </FramePanel>
          <FrameFooter className="px-0 py-2">
            <PromptBox
              value={input}
              onChange={setInput}
              onSubmit={handleSend}
              disabled={!chatSessionId || chatIsLoading}
              placeholder="Describe your Minecraft structure..."
            />
          </FrameFooter>
        </Frame>
      </div>
    </div>
  );
}
