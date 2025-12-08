import { createContext, useContext, forwardRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { cx } from "class-variance-authority";

// Context for sharing state between compound components
const PromptBoxContext = createContext(null);

function usePromptBoxContext() {
  const context = useContext(PromptBoxContext);
  if (!context) {
    throw new Error(
      "PromptBox compound components must be used within a PromptBox"
    );
  }
  return context;
}

// Arrow icon component
function ArrowIcon({ className }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}

// Root component
function PromptBoxRoot({
  children,
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = "Type a message...",
  className = "",
  ...props
}) {
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
    <PromptBoxContext.Provider
      value={{
        value,
        onChange,
        disabled,
        isActive,
        placeholder,
        handleKeyDown,
      }}
    >
      <form
        onSubmit={handleSubmit}
        className={cx(
          "w-full flex flex-col",
          "border border-slate-400 rounded-2xl",
          "shadow-sm shadow-slate-900/5",
          "p-3",
          "transition-colors duration-150",
          "focus-within:border-slate-300",
          className
        )}
        {...props}
      >
        {children}
      </form>
    </PromptBoxContext.Provider>
  );
}

// Input component (textarea with autosize)
const PromptBoxInput = forwardRef(function PromptBoxInput(
  { className = "", minRows = 1, maxRows = 5, ...props },
  ref
) {
  const { value, onChange, disabled, placeholder, handleKeyDown } =
    usePromptBoxContext();

  return (
    <TextareaAutosize
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      minRows={minRows}
      maxRows={maxRows}
      className={cx(
        "w-full px-1 resize-none bg-transparent outline-none",
        "text-slate-900 placeholder:text-slate-400",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  );
});

// Submit button component
function PromptBoxSubmit({ className = "", children, ...props }) {
  const { isActive } = usePromptBoxContext();

  return (
    <button
      type="submit"
      disabled={!isActive}
      className={cx(
        "self-end",
        "p-2 rounded-lg",
        "flex items-center justify-center",
        "transition-all duration-150 origin-center",
        className,
        {
          "bg-slate-900 text-white cursor-pointer hover:bg-slate-800": isActive,
          "bg-slate-300 text-slate-500 cursor-not-allowed": !isActive,
        }
      )}
      {...props}
    >
      {children || <ArrowIcon />}
    </button>
  );
}

// Compose the compound component
export const PromptBox = Object.assign(PromptBoxRoot, {
  Input: PromptBoxInput,
  Submit: PromptBoxSubmit,
});

// Convenience wrapper - fully assembled PromptBox
export function PromptBoxWrapper({
  value,
  onChange,
  onSubmit,
  disabled = false,
  isLoading = false,
  placeholder = "Type a message...",
  className = "",
}) {
  return (
    <PromptBox
      value={value}
      onChange={onChange}
      onSubmit={onSubmit}
      disabled={disabled || isLoading}
      placeholder={placeholder}
      className={className}
    >
      <PromptBox.Input />
      <PromptBox.Submit />
    </PromptBox>
  );
}
