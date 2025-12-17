import { useSession } from "@/hooks/useSession";
import { listSessionsResponseSchema, storeSessionSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PromptBox } from "./PromptBox";
import { SuggestionButtons } from "./SuggestionButton.tsx";
import ThumbnailViewer from "./ThumbnailViewer";

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
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const result = listSessionsResponseSchema.parse(data);
        const sessions = result.sessions;

        const storeSessions = sessions.map((s) => storeSessionSchema.parse(s));
        addSessions(storeSessions);
        setIsLoading(false);

        // Only fetch structure data for sessions that need to render (no cached thumbnail)
        // Sessions with cached thumbnails will show the cached image instead
        storeSessions.forEach((sesh) => {
          if (sesh.has_structure && !sesh.has_thumbnail) {
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

  const formatRelativeTime = (isoString: string) => {
    if (!isoString) return "Unknown";
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays >= 7) return "over a week ago";
    if (diffDays >= 1) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    if (diffHours >= 1) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffMins >= 1) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    return "just now";
  };

  return (
    <div
      className={cn(
        "min-h-screen bg-spatial grid font-text",
        hasSessions ? "grid-rows-[auto_1fr]" : "grid-rows-1"
      )}
    >
      {/* Hero Section with Chat Bar */}
      <div
        className={cn(
          "flex flex-col items-center justify-center px-8",
          hasSessions ? "py-24 pb-12" : "min-h-screen py-12"
        )}
      >
        <div className="w-full max-w-5xl flex flex-col items-center">
          <h1 className="text-6xl font-medium text-foreground/90 mb-5 tracking-tight font-display leading-tight">
            MinecraftLM
          </h1>
          <p className="text-xl text-muted-foreground/80 mb-8 font-normal text-center max-w-lg leading-relaxed">
            What would you like to build?
          </p>

          {/* Chat Input */}
          <PromptBox
            onSubmit={handleSubmit}
            disabled={isCreating}
            placeholder="Describe what you want to build..."
            variant="hero"
            className="max-w-2xl"
          />

          <SuggestionButtons disabled={isCreating} />
        </div>
      </div>

      {/* Previous Sessions Section */}
      {!isLoading && hasSessions && (
        <div className="px-8 pb-16 flex justify-center items-start">
          <div className="w-full max-w-5xl">
            <h2 className="text-sm font-medium text-muted-foreground/70 uppercase tracking-widest mb-8">
              Past Projects
            </h2>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-5">
              {Object.values(sessions)
                .sort((a, b) => {
                  const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
                  const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
                  return dateB - dateA; // Most recent first
                })
                .map((session) => (
                <div
                  key={session.session_id}
                  onClick={() => handleSelectSession(session.session_id)}
                  className={cn(
                    "cursor-pointer overflow-hidden",
                    "relative aspect-square rounded-3xl",
                    "shadow-xl shadow-black/25",
                    "transition-all duration-500 transition-spring-soft",
                    "hover:shadow-2xl hover:shadow-black/40",
                    "hover:scale-[1.03]",
                    "active:scale-[0.98]",
                    "group"
                  )}
                >
                  {/* Thumbnail - full bleed */}
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-zinc-600 to-zinc-800">
                    {session.has_thumbnail ? (
                      <img
                        src={`/api/sessions/${session.session_id}/thumbnail`}
                        alt="Structure preview"
                        className="w-full h-full object-cover"
                      />
                    ) : session.has_structure && session.structure ? (
                      <ThumbnailViewer
                        structureData={session.structure}
                      />
                    ) : (
                      <div className="text-white/30 text-4xl">
                        📦
                      </div>
                    )}
                  </div>

                  {/* Glass edge material - continuous blur vignette */}
                  <div
                    className={cn(
                      "absolute inset-0 pointer-events-none rounded-3xl glass-edge-vignette",
                      "backdrop-blur-2xl backdrop-saturate-150",
                      "bg-gradient-to-b from-white/[0.18] via-white/[0.08] to-white/[0.02]",
                      "dark:from-white/[0.12] dark:via-white/[0.05] dark:to-white/[0.01]"
                    )}
                  />

                  {/* Gradient overlay for text readability */}
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 via-black/20 to-transparent pointer-events-none" />

                  {/* Metadata overlay */}
                  <div className="absolute top-0 right-0 p-3 text-white">
                    <div className="text-[11px] text-white/70">
                      {formatRelativeTime(session.updated_at)}
                    </div>
                  </div>

                  {/* Subtle ring */}
                  <div className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10 pointer-events-none" />
                </div>
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
