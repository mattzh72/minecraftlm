import { create } from 'zustand';

const useSessionStore = create((set, get) => ({
  // State
  sessionId: null,
  structureData: null,
  conversation: [],
  isLoading: false,

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

      // Update URL with new session ID
      const url = new URL(window.location.href);
      url.searchParams.set('session', data.session_id);
      window.history.pushState({}, '', url);

      console.log('Session created:', data.session_id);
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
        console.log('Session not found, creating new one');
        return get().createSession();
      }

      const data = await response.json();
      set({
        sessionId: data.session_id,
        conversation: data.conversation || [],
        structureData: data.structure,
      });
      console.log('Session restored:', data.session_id);
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

  resetSession: () => set({
    sessionId: null,
    structureData: null,
    conversation: [],
    isLoading: false,
  }),
}));

export default useSessionStore;
