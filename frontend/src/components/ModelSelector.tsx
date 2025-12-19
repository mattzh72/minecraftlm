import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Model, ModelProvider, modelsResponseSchema } from '@/lib/schemas';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { useEffect, useMemo, useState } from 'react';

// Display names for providers
const PROVIDER_LABELS = {
  gemini: 'Google',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
} as const;

// Extract display name from model ID
function getModelDisplayName(modelId: string) {
  // Remove provider prefix (e.g., "gemini/" or nothing for others)
  let name = modelId.replace(/^[^/]+\//, '');
  // Remove -preview suffix for cleaner display
  name = name.replace(/-preview$/, '');
  return name;
}

type ModelSelectorProps = {
  variant?: 'default' | 'hero';
};

export function ModelSelector({ variant = 'default' }: ModelSelectorProps) {
  const isLight = variant === 'hero';
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
  }, [activeSessionId, sessions]);
  const hasConversation = activeSession?.conversation && activeSession.conversation.length > 0;
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
      try {
        const response = await fetch('/api/models');
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.status}`);
        }
        const data = await response.json();
        const parsed = modelsResponseSchema.parse(data);
        setModels(parsed.models);
        if (!selectedModelId && parsed.default) {
          setSelectedModelId(parsed.default);
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
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
              className={cn(
                'w-auto max-w-20 inline-flex items-center gap-1.5 px-2.5 py-1 h-8 rounded-lg text-xs cursor-not-allowed',
                isLight
                  ? 'bg-white/20 border border-black/10 text-foreground/40'
                  : 'bg-black/30 border border-white/10 text-white/40',
              )}
            >
              <span className="truncate block">
                {selectedModel ? getModelDisplayName(selectedModel.id) : 'Select'}
              </span>
            </button>
          }
        />
        <DialogPopup>
          <DialogHeader className="p-6">
            <DialogTitle>Model Locked</DialogTitle>
            <DialogDescription>
              You cannot switch models during an active conversation. Each provider uses different
              internal IDs for tool calls, making mid-conversation switches incompatible.
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
      value={selectedModelId}
      onValueChange={(value) => {
        if (value) {
          setSelectedModelId(value);
        }
      }}
      disabled={!!hasConversation}
    >
      <SelectTrigger
        size="sm"
        className={cn(
          'h-8 py-1.5 text-xs transition-all hover:cursor-pointer',
          isLight
            ? 'bg-white/20 border-black/10 text-foreground/80 hover:bg-white/30 hover:text-foreground/90'
            : 'bg-black/70 border-white/15 text-white/80 hover:bg-black/80 hover:text-white/90',
        )}
      >
        <SelectValue className="truncate">
          <span className="truncate block">
            {selectedModel ? getModelDisplayName(selectedModel.id) : 'Select'}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectPopup variant={isLight ? 'default' : 'dark'}>
        {Object.keys(modelsByProvider).map((provider, idx) => (
          <SelectGroup key={provider}>
            {idx > 0 && <SelectSeparator className={!isLight ? 'bg-white/10' : undefined} />}
            <SelectGroupLabel className={cn('text-xs', !isLight && 'text-white/50')}>
              {PROVIDER_LABELS[provider as keyof typeof PROVIDER_LABELS] || provider}
            </SelectGroupLabel>
            {modelsByProvider[provider as keyof typeof modelsByProvider].map((model) => (
              <SelectItem
                key={model.id}
                value={model.id}
                className={cn(
                  'text-xs',
                  !isLight &&
                    'text-white/80 data-highlighted:bg-white/15 data-highlighted:text-white',
                )}
              >
                {getModelDisplayName(model.id)}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectPopup>
    </Select>
  );
}
