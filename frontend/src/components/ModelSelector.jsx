import { useEffect, useState } from "react";
import useModelStore from "@/store/modelStore";
import useSessionStore from "@/store/sessionStore";
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
import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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

  const conversation = useSessionStore((state) => state.conversation);
  const hasConversation = conversation && conversation.length > 0;

  const [showLockedDialog, setShowLockedDialog] = useState(false);

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

  // If conversation has started, show locked state with dialog
  if (hasConversation) {
    return (
      <Dialog open={showLockedDialog} onOpenChange={setShowLockedDialog}>
        <DialogTrigger
          render={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 h-8 rounded-lg border border-input bg-background text-xs text-muted-foreground cursor-not-allowed opacity-60"
            >
              {selectedModel ? getModelDisplayName(selectedModel) : "Select model"}
            </button>
          }
        />
        <DialogPopup>
          <DialogHeader className="p-6">
            <DialogTitle>Model Locked</DialogTitle>
            <DialogDescription>
              You cannot switch models during an active conversation. Each provider
              uses different internal IDs for tool calls, making mid-conversation
              switches incompatible.
            </DialogDescription>
            <DialogDescription>
              To use a different model, start a new project from the Projects page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter variant="bare" className="px-6 pb-6">
            <Button variant="outline" onClick={() => setShowLockedDialog(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    );
  }

  return (
    <Select
      value={selectedModel}
      onValueChange={setSelectedModel}
      disabled={disabled}
    >
      <SelectTrigger size="sm" className="w-auto min-w-0 h-8 text-xs">
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
