import { create } from "zustand";
import type {
  StoreSession,
  Model,
  ToolCall,
  RawAssistantMessage,
} from "@/lib/schemas";

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

  // chat state
  agentState: AgentState;
  activeAssistantMessageIndex: number | null;

  // model state
  models: Model[];
  selectedModelId: string | null;

  error: string | null;
};

export type StoreActions = {
  setDraftMessage: (message: string) => void;
  clearDraftMessage: () => void;

  setActiveSession: (
    id: string | null,
    newSessionData?: Partial<StoreSession>
  ) => void;
  clearActiveSession: () => void;

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

  setSelectedModelId: (id: string | null) => void;
  setModels: (models: Model[]) => void;

  addAssistantMessage: (sessionId: string, message: string) => void;
  addStreamDelta: (sessionId: string, delta: string) => void;
  addToolCall: (sessionId: string, toolCall: ToolCall) => void;

  // todo: add tool result

  addThoughtSummary: (sessionId: string, thoughtSummary: string) => void;
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
  activeSession: () => {
    const activeSessionId = get().activeSessionId;
    return activeSessionId ? get().sessions[activeSessionId] : null;
  },
  setActiveSession: (id, newSessionData?: Partial<StoreSession>) => {
    console.log(`setting active session`, { id, newSessionData });
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
  clearActiveSession: () => set({ activeSessionId: null }),

  error: null,
  setError: (error: string | null) => set({ error }),
  clearError: () => set({ error: null }),

  agentState: "idle",
  activeAssistantMessageIndex: null,
  setAgentState: (state) => set({ agentState: state }),

  addToolCall: (sessionId: string, toolCall: ToolCall) => {
    console.log(`addToolCall`, { sessionId, toolCall });
    const session = get().sessions[sessionId];
    if (!session) return;
    console.log(`addToolCall: session`, session);

    const conversation = session.conversation || [];

    const newConversation = [...(session.conversation || [])];

    const assistantMessages = conversation.filter(
      (msg) => msg.role === "assistant"
    );
    const latestAssistantMessage =
      assistantMessages[assistantMessages.length - 1];

    const latestAssistantMessageToolCalls =
      latestAssistantMessage?.role === "assistant"
        ? latestAssistantMessage.tool_calls || []
        : [];

    console.log(
      `addToolCall: latestAssistantMessageToolCalls`,
      latestAssistantMessageToolCalls
    );
    const newToolCalls = [...latestAssistantMessageToolCalls, toolCall];
    const newAssistantMessage = {
      ...latestAssistantMessage,
      tool_calls: newToolCalls,
    };
    console.log(`addToolCall: newAssistantMessage`, newAssistantMessage);
    newConversation[newConversation.length - 1] = newAssistantMessage;
    console.log(`addToolCall: newConversation`, newConversation);
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
  selectedModel: () => {
    const selectedModelId = get().selectedModelId;
    return get().models.find((m) => m.id === selectedModelId) || null;
  },
  setSelectedModelId: (id: string | null) => set({ selectedModelId: id }),
  setModels: (models: Model[]) => set({ models }),
  clearSelectedModelId: () => set({ selectedModelId: null }),

  addSession: (session: StoreSession) => {
    console.log(`addSession`, { session });
    set({ sessions: { ...get().sessions, [session.session_id]: session } });
  },

  addStructureData: (
    sessionId: string,
    structureData: Record<string, unknown>
  ) => {
    const session = get().sessions[sessionId];
    console.log(`[addStructureData]`, { sessionId, session, structureData });
    if (!session) return;
    const newSession = {
      ...session,
      structure: structureData,
    };
    console.log(`[addStructureData] newSession`, newSession);
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
