import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSession } from "@/hooks/useSession";
import ThumbnailViewer from "./ThumbnailViewer";
import { SuggestionButtons } from "./SuggestionButton.tsx";
import { PromptBox } from "./PromptBox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { listSessionsResponseSchema, storeSessionSchema } from "@/lib/schemas";
import { useStore } from "@/store";

export function ProjectsPage() {
  const navigate = useNavigate();
  const { createSession } = useSession();
  const addSessions = useStore((s) => s.addSessions);
  const addStructureData = useStore((s) => s.addStructureData);
  const sessions = useStore((s) => s.sessions);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const hasSessions = useStore((s) => Object.keys(s.sessions).length > 0);

  // Fetch all sessions on mount
  useEffect(() => {
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((data) => {
        const result = listSessionsResponseSchema.parse(data);
        const sessions = result.sessions;

        const storeSessions = sessions.map((s) => storeSessionSchema.parse(s));
        addSessions(storeSessions);
        setIsLoading(false);

        // Fetch structure data for sessions that have structures
        storeSessions.forEach((sesh) => {
          if (sesh.has_structure) {
            fetch(`/api/sessions/${sesh.session_id}/structure`)
              .then((res) => res.json())
              .then((structureData) => {
                addStructureData(sesh.session_id, structureData);
              })
              .catch((err) => {
                console.error(
                  `Error fetching structure for ${sesh.session_id}:`,
                  err
                );
              });
          }
        });
      })
      .catch((err) => {
        console.error("Error fetching sessions:", err);
        setIsLoading(false);
      });
  }, []);

  // Handle creating a new session and navigating to it
  const handleSubmit = async (message: string) => {
    if (!message.trim() || isCreating) return;
    setIsCreating(true);
    const newSessionId = await createSession(message.trim());
    console.log(`newSessionId`, newSessionId);
    setIsCreating(false);

    if (newSessionId) {
      navigate(`/session/${newSessionId}`);
    }
  };

  // Navigate to an existing session
  const handleSelectSession = (sessionId: string) => {
    navigate(`/session/${sessionId}`);
  };

  const formatDate = (isoString: string) => {
    if (!isoString) return "Unknown";
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div
      className={cn(
        "min-h-screen bg-background grid",
        hasSessions ? "grid-rows-[auto_1fr]" : "grid-rows-1"
      )}
    >
      {/* Hero Section with Chat Bar */}
      <div
        className={cn(
          "flex flex-col items-center justify-center px-6",
          hasSessions ? "py-20 pb-10" : "min-h-screen py-10"
        )}
      >
        <div className="w-full max-w-5xl flex flex-col items-center">
          <h1 className="text-5xl font-semibold text-foreground mb-4 tracking-tight">
            MinecraftLM
          </h1>
          <p className="text-lg text-muted-foreground mb-12 font-normal text-center max-w-md">
            Design and export Minecraft schematics with natural language
          </p>

          {/* Chat Input */}
          <PromptBox
            onSubmit={handleSubmit}
            disabled={isCreating}
            placeholder="Describe what you want to build..."
            className="max-w-2xl"
          />

          <SuggestionButtons disabled={isCreating} />
        </div>
      </div>

      {/* Previous Sessions Section */}
      {!isLoading && hasSessions && (
        <div className="px-6 pb-16 flex justify-center items-start">
          <div className="w-full max-w-5xl">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-6">
              Recent Projects
            </h2>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
              {Object.values(sessions).map((session) => (
                <Card
                  key={session.session_id}
                  onClick={() => handleSelectSession(session.session_id)}
                  className="cursor-pointer overflow-hidden p-0 hover:border-border/80 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="w-full h-44 bg-muted flex items-center justify-center border-b border-border">
                    {session.has_structure && session.structure ? (
                      <ThumbnailViewer structureData={session.structure} />
                    ) : (
                      <div className="text-muted-foreground/50 text-5xl text-center">
                        📦
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="p-3.5">
                    <div className="flex justify-between items-center text-sm text-muted-foreground mb-1.5">
                      <span>{session.message_count ?? 0} messages</span>
                      {session.has_structure && (
                        <Badge
                          variant="success"
                          className="h-1.5 w-1.5 p-0 rounded-full"
                        />
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground/70">
                      {formatDate(session.updated_at)}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !hasSessions && (
        <div className="flex-1 flex items-center justify-center p-12 text-muted-foreground text-sm">
          Start building by typing in the chat above
        </div>
      )}
    </div>
  );
}
