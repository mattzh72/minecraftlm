import { create } from 'zustand';

const useSessionStore = create((set, get) => ({
  // State
  sessionId: null,
  structureData: null,
  conversation: [],
  isLoading: false,
  previewBlocks: [], // Blocks being streamed for real-time preview

  // Actions
  createSession: async (initialMessage) => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status}`);
      }
      const data = await response.json();

      if (initialMessage) {
        try {
          const initialMessageKey = `initial_message_${data.session_id}`;
          sessionStorage.setItem(initialMessageKey, initialMessage);
        } catch (err) {
          console.error('Error storing initial message:', err);
        }
      }

      set({ sessionId: data.session_id, conversation: [] });
      return data.session_id;
    } catch (error) {
      console.error('Error creating session:', error);
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  restoreSession: async (sessionId) => {
    set({ isLoading: true });
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (!response.ok) {
        return get().createSession();
      }

      const data = await response.json();
      set({
        sessionId: data.session_id,
        conversation: data.conversation || [],
        structureData: data.structure,
      });
      return data.session_id;
    } catch (error) {
      console.error('Error restoring session:', error);
      return get().createSession();
    } finally {
      set({ isLoading: false });
    }
  },

  initializeSession: async () => {
    const url = new URL(window.location.href);
    const sessionFromUrl = url.searchParams.get('session');

    if (sessionFromUrl) {
      return get().restoreSession(sessionFromUrl);
    }
    return get().createSession();
  },

  setStructureData: (data) => set({ structureData: data }),
  setSessionId: (id) => set({ sessionId: id }),
  setConversation: (conv) => set({ conversation: conv }),

  // Preview blocks actions
  addPreviewBlock: (block) => {
    set((state) => ({
      previewBlocks: [...state.previewBlocks, block],
    }));
  },
  clearPreviewBlocks: () => set({ previewBlocks: [] }),

  resetSession: () => set({
    sessionId: null,
    structureData: null,
    conversation: [],
    isLoading: false,
    previewBlocks: [],
  }),
}));

export default useSessionStore;
