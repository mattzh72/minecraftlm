import { useEffect } from "react";
import useModelStore from "@/store/modelStore";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectPopup,
  SelectItem,
  SelectGroup,
  SelectGroupLabel,
  SelectSeparator,
} from "@/components/ui/select";

// Display names for providers
const PROVIDER_LABELS = {
  gemini: "Google",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

// Extract display name from model ID
function getModelDisplayName(modelId) {
  // Remove provider prefix (e.g., "gemini/" or nothing for others)
  const name = modelId.replace(/^[^/]+\//, "");
  return name;
}

export function ModelSelector({ disabled = false }) {
  const models = useModelStore((state) => state.models);
  const selectedModel = useModelStore((state) => state.selectedModel);
  const isLoading = useModelStore((state) => state.isLoading);
  const fetchModels = useModelStore((state) => state.fetchModels);
  const setSelectedModel = useModelStore((state) => state.setSelectedModel);
  const getModelsByProvider = useModelStore((state) => state.getModelsByProvider);

  // Fetch models on mount
  useEffect(() => {
    if (models.length === 0) {
      fetchModels();
    }
  }, [models.length, fetchModels]);

  const modelsByProvider = getModelsByProvider();
  const providers = Object.keys(modelsByProvider);

  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground">Loading models...</div>
    );
  }

  if (models.length === 0) {
    return null;
  }

  return (
    <Select
      value={selectedModel}
      onValueChange={setSelectedModel}
      disabled={disabled}
    >
      <SelectTrigger size="sm" className="w-auto min-w-0 text-xs">
        <SelectValue placeholder="Select model">
          {selectedModel ? getModelDisplayName(selectedModel) : "Select model"}
        </SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {providers.map((provider, idx) => (
          <SelectGroup key={provider}>
            {idx > 0 && <SelectSeparator />}
            <SelectGroupLabel>
              {PROVIDER_LABELS[provider] || provider}
            </SelectGroupLabel>
            {modelsByProvider[provider].map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {getModelDisplayName(model.id)}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectPopup>
    </Select>
  );
}

export default ModelSelector;
