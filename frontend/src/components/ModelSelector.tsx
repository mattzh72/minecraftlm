import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/store";
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
import { Model, ModelProvider, modelsResponseSchema } from "@/lib/schemas";

// Display names for providers
const PROVIDER_LABELS = {
  gemini: "Google",
  openai: "OpenAI",
  anthropic: "Anthropic",
} as const;

// Extract display name from model ID
function getModelDisplayName(modelId: string) {
  // Remove provider prefix (e.g., "gemini/" or nothing for others)
  const name = modelId.replace(/^[^/]+\//, "");
  return name;
}

export function ModelSelector() {
  const models = useStore((state) => state.models);
  const sessions = useStore((state) => state.sessions);
  const selectedModelId = useStore((state) => state.selectedModelId);
  const selectedModel = useMemo(() => {
    return models.find((m) => m.id === selectedModelId) || null;
  }, [models, selectedModelId]);
  const setSelectedModelId = useStore((state) => state.setSelectedModelId);
  const setModels = useStore((state) => state.setModels);
  const activeSessionId = useStore((state) => state.activeSessionId);
  const activeSession = useMemo(() => {
    return activeSessionId ? sessions[activeSessionId] : null;
  }, []);
  const hasConversation =
    activeSession?.conversation && activeSession.conversation.length > 0;
  const [showLockedDialog, setShowLockedDialog] = useState(false);

  const modelsByProvider = useMemo(() => {
    return models.reduce((acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    }, {} as Record<ModelProvider, Model[]>);
  }, [models]);

  useEffect(() => {
    if (models.length > 0) return;

    async function fetchModels() {
      console.log(`[fetchModels] fetching models`);
      try {
        const response = await fetch("/api/models");
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status}`);
        }
        const data = await response.json();
        const parsed = modelsResponseSchema.parse(data);
        console.log(`[fetchModels] parsed`, parsed);
        setModels(parsed.models);
        if (!selectedModelId && parsed.default) {
          console.log(`[fetchModels] setting default model`, parsed.default);
          setSelectedModelId(parsed.default);
        }
      } catch (error) {
        console.error("Failed to fetch models:", error);
      }
    }

    fetchModels();
  }, []);

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
              {selectedModel
                ? getModelDisplayName(selectedModel.id)
                : "Select model"}
            </button>
          }
        />
        <DialogPopup>
          <DialogHeader className="p-6">
            <DialogTitle>Model Locked</DialogTitle>
            <DialogDescription>
              You cannot switch models during an active conversation. Each
              provider uses different internal IDs for tool calls, making
              mid-conversation switches incompatible.
            </DialogDescription>
            <DialogDescription>
              To use a different model, start a new project from the Projects
              page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter variant="bare" className="px-6 pb-6">
            <Button
              variant="outline"
              onClick={() => setShowLockedDialog(false)}
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    );
  }

  return (
    <Select
      value={selectedModelId}
      onValueChange={(value) => {
        if (value) {
          console.log(`[ModelSelector] setting selected model id`, value);
          setSelectedModelId(value);
        }
      }}
      disabled={!!hasConversation}
    >
      <SelectTrigger size="sm" className="w-auto min-w-0 h-8 text-xs">
        <SelectValue>
           {selectedModel ? getModelDisplayName(selectedModel.id) : "Select model"}
        </SelectValue>
      </SelectTrigger>
      <SelectPopup>
        {Object.keys(modelsByProvider).map((provider, idx) => (
          <SelectGroup key={provider}>
            {idx > 0 && <SelectSeparator />}
            <SelectGroupLabel>
              {PROVIDER_LABELS[provider as keyof typeof PROVIDER_LABELS] ||
                provider}
            </SelectGroupLabel>
            {modelsByProvider[provider as keyof typeof modelsByProvider].map(
              (model) => (
                <SelectItem key={model.id} value={model.id}>
                  {getModelDisplayName(model.id)}
                </SelectItem>
              )
            )}
          </SelectGroup>
        ))}
      </SelectPopup>
    </Select>
  );
}
