import { create } from "zustand";

/**
 * Chat states following state machine patterns
 */
export const ChatState = {
  IDLE: "idle",
  THINKING: "thinking",
  STREAMING_THOUGHT: "streaming_thought",
  STREAMING_TEXT: "streaming_text",
  TOOL_CALLING: "tool_calling",
  ERROR: "error",
} as const;

type ChatStateValue = (typeof ChatState)[keyof typeof ChatState];

/**
 * Action types
 */
export const ActionTypes = {
  START_REQUEST: "START_REQUEST",
  TURN_START: "TURN_START",
  THOUGHT_DELTA: "THOUGHT_DELTA",
  TEXT_DELTA: "TEXT_DELTA",
  TOOL_CALL: "TOOL_CALL",
  TOOL_RESULT: "TOOL_RESULT",
  COMPLETE: "COMPLETE",
  ERROR: "ERROR",
  CLEAR_PENDING: "CLEAR_PENDING",
  RESET: "RESET",
} as const;

type Action =
  | { type: typeof ActionTypes.START_REQUEST; payload: { userMessage: string; abortController: AbortController } }
  | { type: typeof ActionTypes.TURN_START }
  | { type: typeof ActionTypes.THOUGHT_DELTA; payload: { delta: string } }
  | { type: typeof ActionTypes.TEXT_DELTA; payload: { delta: string } }
  | { type: typeof ActionTypes.TOOL_CALL; payload: { name: string; args: unknown } }
  | { type: typeof ActionTypes.TOOL_RESULT; payload: { result: unknown } }
  | { type: typeof ActionTypes.COMPLETE; payload: { success: boolean; reason: string } }
  | { type: typeof ActionTypes.ERROR; payload: { message: string } }
  | { type: typeof ActionTypes.CLEAR_PENDING }
  | { type: typeof ActionTypes.RESET };

interface ChatStoreState {
  state: ChatStateValue;
  streamingThought: string;
  streamingText: string;
  pendingUserMessage: string | null;
  error: string | null;
  abortController: AbortController | null;
}

interface ChatStoreActions {
  startRequest: (userMessage: string) => AbortController;
  onTurnStart: () => void;
  onThoughtDelta: (delta: string) => void;
  onTextDelta: (delta: string) => void;
  onToolCall: (name: string, args: unknown) => void;
  onToolResult: (result: unknown) => void;
  onComplete: (success: boolean, reason: string) => void;
  onError: (message: string) => void;
  clearPendingMessage: () => void;
  reset: () => void;
}

interface ChatStore extends ChatStoreState {
  dispatch: (action: Action) => void;
  actions: ChatStoreActions;
  isLoading: () => boolean;
  isThinking: () => boolean;
  isStreamingThought: () => boolean;
  isStreamingText: () => boolean;
}

/**
 * Reducer function for state transitions
 */
const reducer = (state: ChatStoreState, action: Action): ChatStoreState => {
  switch (action.type) {
    case ActionTypes.START_REQUEST:
      return {
        ...state,
        state: ChatState.THINKING,
        pendingUserMessage: action.payload.userMessage,
        streamingThought: "",
        streamingText: "",
        error: null,
        abortController: action.payload.abortController,
      };

    case ActionTypes.TURN_START:
      if (state.state === ChatState.IDLE) return state;
      return {
        ...state,
        state: ChatState.THINKING,
        streamingThought: "",
        streamingText: "",
      };

    case ActionTypes.THOUGHT_DELTA:
      if (state.state !== ChatState.THINKING && state.state !== ChatState.STREAMING_THOUGHT) {
        return state;
      }
      return {
        ...state,
        state: ChatState.STREAMING_THOUGHT,
        streamingThought: state.streamingThought + action.payload.delta,
      };

    case ActionTypes.TEXT_DELTA:
      return {
        ...state,
        state: ChatState.STREAMING_TEXT,
        streamingText: state.streamingText + action.payload.delta,
      };

    case ActionTypes.TOOL_CALL:
      return {
        ...state,
        state: ChatState.TOOL_CALLING,
      };

    case ActionTypes.TOOL_RESULT:
      return state;

    case ActionTypes.COMPLETE:
      return {
        ...state,
        state: ChatState.IDLE,
        abortController: null,
      };

    case ActionTypes.ERROR:
      return {
        ...state,
        state: ChatState.ERROR,
        error: action.payload.message,
        abortController: null,
      };

    case ActionTypes.CLEAR_PENDING:
      return {
        ...state,
        pendingUserMessage: null,
      };

    case ActionTypes.RESET:
      return {
        ...state,
        state: ChatState.IDLE,
        streamingThought: "",
        streamingText: "",
        pendingUserMessage: null,
        error: null,
        abortController: null,
      };

    default:
      return state;
  }
};

const initialState: ChatStoreState = {
  state: ChatState.IDLE,
  streamingThought: "",
  streamingText: "",
  pendingUserMessage: null,
  error: null,
  abortController: null,
};

const useChatStore = create<ChatStore>((set, get) => ({
  ...initialState,

  dispatch: (action: Action) => {
    set((state) => reducer(state, action));
  },

  actions: {
    startRequest: (userMessage: string) => {
      const existingController = get().abortController;
      if (existingController) {
        existingController.abort();
      }

      const abortController = new AbortController();
      get().dispatch({
        type: ActionTypes.START_REQUEST,
        payload: { userMessage, abortController },
      });
      return abortController;
    },

    onTurnStart: () => {
      get().dispatch({ type: ActionTypes.TURN_START });
    },

    onThoughtDelta: (delta: string) => {
      get().dispatch({ type: ActionTypes.THOUGHT_DELTA, payload: { delta } });
    },

    onTextDelta: (delta: string) => {
      get().dispatch({ type: ActionTypes.TEXT_DELTA, payload: { delta } });
    },

    onToolCall: (name: string, args: unknown) => {
      get().dispatch({ type: ActionTypes.TOOL_CALL, payload: { name, args } });
    },

    onToolResult: (result: unknown) => {
      get().dispatch({ type: ActionTypes.TOOL_RESULT, payload: { result } });
    },

    onComplete: (success: boolean, reason: string) => {
      get().dispatch({ type: ActionTypes.COMPLETE, payload: { success, reason } });
    },

    onError: (message: string) => {
      get().dispatch({ type: ActionTypes.ERROR, payload: { message } });
    },

    clearPendingMessage: () => {
      get().dispatch({ type: ActionTypes.CLEAR_PENDING });
    },

    reset: () => {
      const controller = get().abortController;
      if (controller) {
        controller.abort();
      }
      get().dispatch({ type: ActionTypes.RESET });
    },
  },

  isLoading: () => {
    const state = get().state;
    return state !== ChatState.IDLE && state !== ChatState.ERROR;
  },

  isThinking: () => {
    const state = get().state;
    return state === ChatState.THINKING || state === ChatState.TOOL_CALLING;
  },

  isStreamingThought: () => {
    return get().state === ChatState.STREAMING_THOUGHT;
  },

  isStreamingText: () => {
    return get().state === ChatState.STREAMING_TEXT;
  },
}));

export default useChatStore;
