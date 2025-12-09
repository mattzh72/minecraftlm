import { create } from 'zustand';

const useModelStore = create((set, get) => ({
  // State
  models: [],
  selectedModel: null,
  defaultModel: null,
  isLoading: false,
  error: null,

  // Actions
  fetchModels: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/models');
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }
      const data = await response.json();

      set({
        models: data.models,
        defaultModel: data.default,
        // Set selected model to default if not already set
        selectedModel: get().selectedModel || data.default,
      });
    } catch (error) {
      console.error('Error fetching models:', error);
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  setSelectedModel: (modelId) => set({ selectedModel: modelId }),

  // Get models grouped by provider
  getModelsByProvider: () => {
    const models = get().models;
    return models.reduce((acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    }, {});
  },
}));

export default useModelStore;
