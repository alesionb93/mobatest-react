import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

const fieldBase =
  "w-full py-2 px-3 text-sm rounded-lg border bg-card text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed";

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, rightElement, id, ...props }, ref) => {
    const inputId = id ?? React.useId();
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {leftIcon}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              fieldBase,
              leftIcon && "pl-9",
              rightElement && "pr-9",
              error ? "border-destructive focus:ring-destructive" : "border-input",
              className
            )}
            {...props}
          />
          {rightElement && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightElement}</span>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, "type" | "rightElement">>(
  (props, ref) => {
    const [visible, setVisible] = React.useState(false);
    return (
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        rightElement={
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          >
            {visible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        }
        {...props}
      />
    );
  }
);
PasswordInput.displayName = "PasswordInput";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const areaId = id ?? React.useId();
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={areaId} className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <textarea
          id={areaId}
          ref={ref}
          className={cn(
            fieldBase,
            "min-h-24 resize-y",
            error ? "border-destructive focus:ring-destructive" : "border-input",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export { Input, PasswordInput, Textarea };
