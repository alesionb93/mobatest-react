import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps {
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

function Checkbox({ checked, onCheckedChange, disabled, className, ...aria }: CheckboxProps) {
  const isChecked = checked === true;
  const isIndeterminate = checked === "indeterminate";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isIndeterminate ? "mixed" : isChecked}
      disabled={disabled}
      onClick={() => onCheckedChange(!isChecked)}
      className={cn(
        "h-[18px] w-[18px] shrink-0 rounded border border-input flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        (isChecked || isIndeterminate) && "bg-primary border-primary",
        className
      )}
      {...aria}
    >
      {isChecked && <Check size={13} className="text-primary-foreground" strokeWidth={3} />}
      {isIndeterminate && <Minus size={13} className="text-primary-foreground" strokeWidth={3} />}
    </button>
  );
}

export interface RadioProps {
  checked: boolean;
  onCheckedChange: () => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

function Radio({ checked, onCheckedChange, disabled, className, ...aria }: RadioProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onCheckedChange}
      className={cn(
        "h-[18px] w-[18px] shrink-0 rounded-full border border-input flex items-center justify-center focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
        checked && "border-primary",
        className
      )}
      {...aria}
    >
      {checked && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
    </button>
  );
}

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

function Switch({ checked, onCheckedChange, disabled, className, ...aria }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "h-6 w-11 shrink-0 rounded-full border border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 relative",
        checked ? "bg-primary" : "bg-muted",
        className
      )}
      {...aria}
    >
      <span
        className={cn(
          "block h-5 w-5 rounded-full bg-white shadow-elevation-sm transition-transform duration-200 absolute top-0.5",
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export { Checkbox, Radio, Switch };
