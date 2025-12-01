import { create } from 'zustand';

const useSessionStore = create((set) => ({
  // State
  sessionId: null,
  structureData: null,
  isCreatingSession: false,

  // Actions
  createSession: async () => {
    set({ isCreatingSession: true });
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
      });
      const data = await response.json();
      set({ sessionId: data.session_id });
      console.log('Session created:', data.session_id);
    } catch (error) {
      console.error('Error creating session:', error);
    } finally {
      set({ isCreatingSession: false });
    }
  },

  setStructureData: (data) => set({ structureData: data }),
  setSessionId: (id) => set({ sessionId: id }),
}));

export default useSessionStore;
