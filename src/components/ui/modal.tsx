import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: "sm" | "md" | "lg";
  /** Desligar fechamento por clique fora — usar em formulários extensos (ex: defeito) */
  closeOnOutsideClick?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

function Modal({
  open,
  onClose,
  title,
  size = "md",
  closeOnOutsideClick = true,
  children,
  footer,
}: ModalProps) {
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onMouseDown={(e) => {
        if (closeOnOutsideClick && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "w-full rounded-xl bg-card shadow-xl border border-border flex flex-col max-h-[90vh]",
          sizeClasses[size]
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground rounded-md p-1 focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-border flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export { Modal };
