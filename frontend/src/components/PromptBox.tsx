import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";
import { ArrowUp } from "lucide-react";
import { forwardRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { ModelSelector } from "./ModelSelector.tsx";

type PromptBoxProps = {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  variant?: "default" | "hero";
  className?: string;
};

export const PromptBox = forwardRef<HTMLTextAreaElement, PromptBoxProps>(
  function PromptBox(
    {
      onSubmit,
      disabled = false,
      placeholder = "Type a message...",
      variant = "default",
      className = "",
    },
    ref
  ) {
    const value = useStore((s) => s.draftMessage);
    const setDraftMessage = useStore((s) => s.setDraftMessage);
    const clearDraftMessage = useStore((s) => s.clearDraftMessage);

    const isActive = value?.trim() && !disabled;

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (isActive && onSubmit) {
        onSubmit(value);
        clearDraftMessage();
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (isActive && onSubmit) {
          onSubmit(value);
          clearDraftMessage();
        }
      }
    };

    return (
      <form
        onSubmit={handleSubmit}
        data-variant={variant}
        className={cn(
          "w-full flex flex-col gap-3",
          variant === "hero"
            ? [
                "relative rounded-3xl p-5",
                "glass-panel-hero",
                "hover:shadow-[var(--shadow-glass-hover)] hover:scale-[1.01]",
                "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]",
                "before:bg-gradient-to-b before:from-white/[0.35] before:via-white/[0.12] before:to-transparent before:opacity-80",
              ]
            : [
                "rounded-xl p-3",
                "bg-black/40",
                "shadow-[inset_0_2px_6px_rgba(0,0,0,0.3)]",
                "border border-white/10",
                "focus-within:bg-black/50",
                "focus-within:shadow-[inset_0_2px_8px_rgba(0,0,0,0.4)]",
              ],
          "transition-all duration-200",
          className
        )}
      >
        <TextareaAutosize
          ref={ref}
          value={value}
          onChange={(e) => setDraftMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          minRows={1}
          maxRows={5}
          className={cn(
            "w-full px-1 resize-none bg-transparent outline-none",
            variant === "hero"
              ? "text-foreground/90 placeholder:text-muted-foreground/60"
              : "text-white/90 placeholder:text-white/40",
            "text-sm leading-relaxed",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "font-text"
          )}
        />

        <div className="flex justify-end gap-2">
          <ModelSelector />
          <Button
            type="submit"
            disabled={!isActive}
            size="icon"
            className={cn(
              "self-end",
              "transition-all duration-200 transition-spring",
              "hover:scale-105",
              "active:scale-95"
            )}
          >
            <ArrowUp size={18} strokeWidth={2.5} />
          </Button>
        </div>
      </form>
    );
  }
);
