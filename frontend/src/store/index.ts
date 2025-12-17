import { create } from "zustand";
import type {
  StoreSession,
  Model,
  ToolCall,
  RawAssistantMessage,
  ThinkingLevel,
} from "@/lib/schemas";
import type { TimeOfDay } from "@/config";

export type ViewerMode = "orbit" | "playable";

export type AgentState =
  | "idle"
  | "thinking"
  | "streaming_text"
  | "tool_calling"
  | "error";

export type StoreStateBase = {
  draftMessage: string;

  // session state
  sessions: Record<string, StoreSession>;
  activeSessionId: string | null;

  // thumbnail capture request (triggered on successful task completion)
  thumbnailCaptureRequest: { sessionId: string; nonce: number } | null;

  // renderer time of day
  timeOfDay: TimeOfDay;

  // viewer mode (orbit camera vs playable first-person)
  viewerMode: ViewerMode;

  // chat state
  agentState: AgentState;
  activeAssistantMessageIndex: number | null;

  // stream management (shared across all useChat instances)
  streamAbortController: AbortController | null;

  // model state
  models: Model[];
  selectedModelId: string | null;

  // thinking level state
  selectedThinkingLevel: ThinkingLevel;

  error: string | null;
};

export type StoreActions = {
  setDraftMessage: (message: string) => void;
  clearDraftMessage: () => void;

  setActiveSession: (
    id: string | null,
    newSessionData?: Partial<StoreSession>
  ) => void;

  // agent actions
  setAgentState: (state: AgentState) => void;
  setActiveAssistantMessageIndex: (index: number | null) => void;
  clearActiveAssistantMessageIndex: () => void;

  addUserMessage: (sessionId: string, message: string) => void;
  addSessions: (sessions: StoreSession[]) => void;
  addStructureData: (
    sessionId: string,
    structureData: Record<string, unknown>
  ) => void;
  addSession: (session: StoreSession) => void;
  removeSession: (sessionId: string) => void;

  setSelectedModelId: (id: string | null) => void;
  setModels: (models: Model[]) => void;

  setSelectedThinkingLevel: (level: ThinkingLevel) => void;

  addAssistantMessage: (sessionId: string, message: string) => void;
  addStreamDelta: (sessionId: string, delta: string) => void;
  addToolCall: (sessionId: string, toolCall: ToolCall) => void;
  addToolResult: (sessionId: string, toolCallId: string, result: string, hasError: boolean) => void;

  requestThumbnailCapture: (sessionId: string) => void;
  clearThumbnailCaptureRequest: () => void;

  setTimeOfDay: (time: TimeOfDay) => void;
  setViewerMode: (mode: ViewerMode) => void;

  addThoughtSummary: (sessionId: string, thoughtSummary: string) => void;

  // stream management actions
  setStreamAbortController: (controller: AbortController | null) => void;
  abortCurrentStream: () => void;
};

const defaultSession: StoreSession = {
  session_id: "",
  has_structure: false,
  message_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  conversation: [],
  structure: null,
};

const defaultAssistantMessage: RawAssistantMessage = {
  role: "assistant",
  content: "",
  thought_summary: "",
  tool_calls: [],
};

export type StoreState = StoreStateBase & StoreActions;

export const useStore = create<StoreState>()((set, get) => ({
  draftMessage: "",
  setDraftMessage: (message: string) => set({ draftMessage: message }),
  clearDraftMessage: () => set({ draftMessage: "" }),

  sessions: {},
  activeSessionId: null,
  thumbnailCaptureRequest: null,
  requestThumbnailCapture: (sessionId: string) =>
    set({
      thumbnailCaptureRequest: { sessionId, nonce: Date.now() },
    }),
  clearThumbnailCaptureRequest: () => set({ thumbnailCaptureRequest: null }),

  timeOfDay: "sunset",
  setTimeOfDay: (time) => set({ timeOfDay: time }),
  viewerMode: "orbit",
  setViewerMode: (mode) => set({ viewerMode: mode }),

  setActiveSession: (id, newSessionData?: Partial<StoreSession>) => {
    if (!id) {
      set({ activeSessionId: null });
      return;
    }
    const sessions = get().sessions;
    const currentSession = sessions[id];
    const newSession = {
      ...defaultSession,
      ...(currentSession || {}),
      ...(newSessionData || {}),
      session_id: id,
    };
    set({
      activeSessionId: newSession.session_id,
      sessions: {
        ...sessions,
        [newSession.session_id]: newSession,
      },
    });
  },

  error: null,

  agentState: "idle",
  activeAssistantMessageIndex: null,
  streamAbortController: null,
  setAgentState: (state) => set({ agentState: state }),

  setStreamAbortController: (controller) => set({ streamAbortController: controller }),
  abortCurrentStream: () => {
    const controller = get().streamAbortController;
    if (controller) {
      controller.abort();
      set({ streamAbortController: null });
    }
  },

  addToolCall: (sessionId: string, toolCall: ToolCall) => {
    const session = get().sessions[sessionId];
    if (!session) return;

    const newConversation = [...(session.conversation || [])];

    // Find the index of the last assistant message
    let assistantIdx = -1;
    for (let i = newConversation.length - 1; i >= 0; i--) {
      if (newConversation[i]?.role === "assistant") {
        assistantIdx = i;
        break;
      }
    }

    if (assistantIdx === -1) return;

    const latestAssistantMessage = newConversation[assistantIdx];
    const existingToolCalls = latestAssistantMessage.tool_calls || [];
    const newToolCalls = [...existingToolCalls, toolCall];

    newConversation[assistantIdx] = {
      ...latestAssistantMessage,
      tool_calls: newToolCalls,
    };

    set({
      sessions: {
        ...get().sessions,
        [sessionId]: { ...session, conversation: newConversation },
      },
    });
  },

  addToolResult: (sessionId: string, toolCallId: string, result: string, hasError: boolean) => {
    const session = get().sessions[sessionId];
    if (!session) return;

    const newConversation = [...(session.conversation || [])];

    // Find and update the tool call in the assistant message
    for (let i = newConversation.length - 1; i >= 0; i--) {
      const msg = newConversation[i];
      if (msg.role === "assistant" && msg.tool_calls) {
        const tcIndex = msg.tool_calls.findIndex((t) => t.id === toolCallId);
        if (tcIndex !== -1) {
          // Update the tool call with its result
          const updatedToolCalls = [...msg.tool_calls];
          updatedToolCalls[tcIndex] = {
            ...updatedToolCalls[tcIndex],
            result: { content: result, hasError },
          };
          newConversation[i] = { ...msg, tool_calls: updatedToolCalls };
          break;
        }
      }
    }

    set({
      sessions: {
        ...get().sessions,
        [sessionId]: { ...session, conversation: newConversation },
      },
    });
  },

  addThoughtSummary: (sessionId: string, thoughtSummary: string) => {
    const session = get().sessions[sessionId];
    if (!session) return;

    const newConversation = [...(session.conversation || [])];

    // Find the last assistant message by iterating backwards
    let assistantIdx = -1;
    for (let i = newConversation.length - 1; i >= 0; i--) {
      if (newConversation[i]?.role === "assistant") {
        assistantIdx = i;
        break;
      }
    }

    if (assistantIdx !== -1) {
      // Append to the existing assistant message's thought_summary
      const currentMessage = newConversation[assistantIdx] as RawAssistantMessage;
      newConversation[assistantIdx] = {
        ...currentMessage,
        thought_summary: (currentMessage.thought_summary || "") + thoughtSummary,
      };
    } else {
      // No assistant message exists yet, create one
      newConversation.push({
        ...defaultAssistantMessage,
        thought_summary: thoughtSummary,
      });
    }

    set({
      sessions: {
        ...get().sessions,
        [sessionId]: { ...session, conversation: newConversation },
      },
    });
  },

  addAssistantMessage: (sessionId: string, message: string) => {
    const session = get().sessions[sessionId];
    if (!session) return;

    const newConversation = [...(session.conversation || [])];
    newConversation.push({
      role: "assistant",
      content: message,
      thought_summary: "",
      tool_calls: [],
    });
    set({
      sessions: {
        ...get().sessions,
        [sessionId]: { ...session, conversation: newConversation },
      },
    });
  },

  addStreamDelta: (sessionId: string, delta: string) => {
    const session = get().sessions[sessionId];
    if (!session) return;

    const latestAssistantMessage =
      session.conversation?.[session.conversation.length - 1];

    if (
      !latestAssistantMessage ||
      latestAssistantMessage.role !== "assistant"
    ) {
      return;
    }

    const newConversation = [...(session.conversation || [])];
    newConversation[newConversation.length - 1] = {
      ...latestAssistantMessage,
      content: latestAssistantMessage.content + delta,
    };
    set((state) => ({
      sessions: {
        ...state.sessions,
        [sessionId]: { ...session, conversation: newConversation },
      },
    }));
  },

  setActiveAssistantMessageIndex: (index) =>
    set({ activeAssistantMessageIndex: index }),
  clearActiveAssistantMessageIndex: () =>
    set({ activeAssistantMessageIndex: null }),

  addUserMessage: (sessionId: string, message: string) => {
    const session = get().sessions[sessionId];
    if (!session) return;
    const newConversation = [...(session.conversation || [])];
    newConversation.push({
      role: "user",
      content: message,
    });
    set({
      sessions: {
        ...get().sessions,
        [sessionId]: { ...session, conversation: newConversation },
      },
    });
  },

  models: [],
  selectedModelId: null,
  selectedThinkingLevel: "med",
  setSelectedModelId: (id: string | null) => set({ selectedModelId: id }),
  setModels: (models: Model[]) => set({ models }),
  setSelectedThinkingLevel: (level) => set({ selectedThinkingLevel: level }),

  addSession: (session: StoreSession) => {
    set({ sessions: { ...get().sessions, [session.session_id]: session } });
  },

  removeSession: (sessionId: string) => {
    const { [sessionId]: _, ...remainingSessions } = get().sessions;
    set({ sessions: remainingSessions });
  },

  addStructureData: (
    sessionId: string,
    structureData: Record<string, unknown>
  ) => {
    const session = get().sessions[sessionId];
    if (!session) return;
    const newSession = {
      ...session,
      structure: structureData,
    };
    set({ sessions: { ...get().sessions, [sessionId]: newSession } });
  },

  addSessions: (sessions: StoreSession[]) => {
    set({
      sessions: {
        ...get().sessions,
        ...sessions.reduce((acc, session) => {
          acc[session.session_id] = session;
          return acc;
        }, {} as Record<StoreSession["session_id"], StoreSession>),
      },
    });
  },
}));
