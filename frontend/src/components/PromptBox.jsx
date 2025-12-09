import { forwardRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const PromptBox = forwardRef(function PromptBox(
  {
    value,
    onChange,
    onSubmit,
    disabled = false,
    placeholder = "Type a message...",
    className = "",
  },
  ref
) {
  const isActive = value?.trim() && !disabled;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isActive && onSubmit) {
      onSubmit(value);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isActive && onSubmit) {
        onSubmit(value);
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "w-full flex flex-col gap-2",
        "rounded-xl border bg-background p-3 shadow-xs",
        className
      )}
    >
      <TextareaAutosize
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        minRows={1}
        maxRows={5}
        className="w-full px-1 resize-none bg-transparent outline-none text-foreground placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <Button
        type="submit"
        disabled={!isActive}
        size="icon"
        className="self-end"
      >
        <ArrowUp size={18} strokeWidth={2.5} />
      </Button>
    </form>
  );
});
