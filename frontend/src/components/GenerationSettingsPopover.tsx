import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import type { ThinkingLevel, Model, ModelProvider } from "@/lib/schemas";
import { modelsResponseSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";
import {
  Settings2,
  Sparkles,
  Brain,
  Zap,
  ChevronDown,
  Check,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const THINKING_LEVELS: {
  value: ThinkingLevel;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "low", label: "Quick", icon: <Zap size={14} /> },
  { value: "med", label: "Balanced", icon: <Sparkles size={14} /> },
  { value: "high", label: "Deep", icon: <Brain size={14} /> },
];

const PROVIDER_LABELS: Record<ModelProvider, string> = {
  gemini: "Google",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

const PROVIDER_ORDER: ModelProvider[] = ["anthropic", "openai", "gemini"];

function getModelDisplayName(modelId: string) {
  const name = modelId.replace(/^[^/]+\//, "");
  return name;
}

function getModelShortName(modelId: string) {
  const name = modelId.replace(/^[^/]+\//, "");
  const parts = name.split("-");
  if (parts.length >= 2) {
    return parts.slice(0, 2).join("-");
  }
  return name.slice(0, 12);
}

type GenerationSettingsPopoverProps = {
  variant?: "default" | "hero";
};

export function GenerationSettingsPopover({
  variant = "default",
}: GenerationSettingsPopoverProps) {
  const isLight = variant === "hero";
  const [open, setOpen] = useState(false);
  const [showLockedDialog, setShowLockedDialog] = useState(false);

  const models = useStore((state) => state.models);
  const sessions = useStore((state) => state.sessions);
  const selectedModelId = useStore((state) => state.selectedModelId);
  const setSelectedModelId = useStore((state) => state.setSelectedModelId);
  const setModels = useStore((state) => state.setModels);
  const activeSessionId = useStore((state) => state.activeSessionId);
  const thinkingLevel = useStore((s) => s.selectedThinkingLevel);
  const setThinkingLevel = useStore((s) => s.setSelectedThinkingLevel);

  const selectedModel = useMemo(() => {
    return models.find((m) => m.id === selectedModelId) || null;
  }, [models, selectedModelId]);

  const activeSession = useMemo(() => {
    return activeSessionId ? sessions[activeSessionId] : null;
  }, [activeSessionId, sessions]);

  const hasConversation =
    activeSession?.conversation && activeSession.conversation.length > 0;

  const modelsByProvider = useMemo(() => {
    const grouped = models.reduce((acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    }, {} as Record<ModelProvider, Model[]>);

    const sorted: [ModelProvider, Model[]][] = [];
    for (const provider of PROVIDER_ORDER) {
      if (grouped[provider]) {
        sorted.push([provider, grouped[provider]]);
      }
    }
    return sorted;
  }, [models]);

  useEffect(() => {
    if (models.length > 0) return;

    async function fetchModels() {
      try {
        const response = await fetch("/api/models");
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
        console.error("Failed to fetch models:", error);
      }
    }

    fetchModels();
  }, []);

  const triggerButton = (
    <button
      type="button"
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 px-3 py-1.5 h-8 rounded-lg text-xs font-medium transition-all",
        isLight
          ? "bg-white/20 border border-black/10 text-foreground/70 hover:bg-white/30 hover:text-foreground/90"
          : "bg-white/6 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white/90",
        hasConversation && "cursor-not-allowed opacity-60",
        !hasConversation && "hover:cursor-pointer"
      )}
    >
      <Settings2 size={14} />
      <span className="truncate max-w-[100px]">
        {selectedModel ? getModelShortName(selectedModel.id) : "Settings"}
      </span>
      {!hasConversation && (
        <ChevronDown
          size={12}
          className={cn(
            "opacity-50 transition-transform",
            open && "rotate-180"
          )}
        />
      )}
    </button>
  );

  if (hasConversation) {
    return (
      <Dialog open={showLockedDialog} onOpenChange={setShowLockedDialog}>
        <DialogTrigger render={triggerButton} />
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={triggerButton} />
      <PopoverPopup side="top" align="start" sideOffset={8} className="w-fit">
        {/* Model Selection */}
        <div className="space-y-1">
          {modelsByProvider.map(([provider, providerModels], idx) => (
            <div key={provider}>
              {idx > 0 && <Separator className="my-2" />}
              <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {PROVIDER_LABELS[provider]}
              </p>
              {providerModels.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => {
                    setSelectedModelId(model.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:bg-accent focus-visible:text-accent-foreground",
                    selectedModelId === model.id && "bg-accent/50"
                  )}
                >
                  <span>{getModelDisplayName(model.id)}</span>
                  {selectedModelId === model.id && (
                    <Check size={14} className="text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        <Separator className="my-3" />

        {/* Reasoning Level */}
        <div className="space-y-2">
          <p className="px-2 text-xs font-medium text-muted-foreground">
            Reasoning
          </p>
          <div className="relative rounded-lg bg-muted/50 p-1">
            <div className="relative grid grid-cols-3 gap-1">
              {THINKING_LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setThinkingLevel(level.value)}
                  className={cn(
                    "relative z-10 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all",
                    thinkingLevel === level.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {level.icon}
                  <span>{level.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
