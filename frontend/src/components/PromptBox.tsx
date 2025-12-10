import { forwardRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store";
import { ModelSelector } from "./ModelSelector.tsx";

type PromptBoxProps = {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

export const PromptBox = forwardRef<HTMLTextAreaElement, PromptBoxProps>(
  function PromptBox(
    {
      onSubmit,
      disabled = false,
      placeholder = "Type a message...",
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
        className={cn(
          "w-full flex flex-col gap-2",
          "rounded-xl border border-border bg-background p-3 shadow-xs",
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
          className="w-full px-1 resize-none bg-transparent outline-none text-foreground placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        />

        <div className="flex justify-between">
          <ModelSelector />
          <Button
            type="submit"
            disabled={!isActive}
            size="icon"
            className="self-end"
          >
            <ArrowUp size={18} strokeWidth={2.5} />
          </Button>
        </div>
      </form>
    );
  }
);
