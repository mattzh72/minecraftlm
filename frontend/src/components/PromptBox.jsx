import { forwardRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { ArrowUp } from "lucide-react";
import { cn } from "../lib/cn";

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
        "w-full flex flex-col",
        "border rounded-2xl border-slate-400",
        "shadow-sm shadow-slate-900/5",
        "p-3",
        "transition-colors duration-150",
        "focus-within:border-slate-300",
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
        className="w-full px-1 resize-none bg-transparent outline-none text-slate-900 placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <button
        type="submit"
        disabled={!isActive}
        className={cn(
          "self-end p-2 rounded-lg flex items-center justify-center transition-all duration-150",
          isActive
            ? "bg-slate-900 text-white cursor-pointer hover:bg-slate-800"
            : "bg-slate-300 text-slate-500 cursor-not-allowed"
        )}
      >
        <ArrowUp size={18} strokeWidth={2.5} />
      </button>
    </form>
  );
});
