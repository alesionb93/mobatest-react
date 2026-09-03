import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  width?: "md" | "lg" | "xl";
  closeOnOutsideClick?: boolean;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

function Drawer({
  open,
  onClose,
  title,
  subtitle,
  width = "md",
  closeOnOutsideClick = true,
  headerActions,
  footer,
  children,
}: DrawerProps) {
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
      className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (closeOnOutsideClick && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        className={cn(
          "h-full w-full bg-card border-l border-border shadow-xl flex flex-col",
          width === "lg" ? "max-w-2xl" : width === "xl" ? "max-w-4xl" : "max-w-lg"
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-foreground truncate">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {headerActions}
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground rounded-md p-1.5 focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-border px-5 py-4 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export { Drawer };
