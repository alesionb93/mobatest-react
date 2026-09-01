import * as React from "react";
import { createPortal } from "react-dom";
import { Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
}

function Combobox({
  options,
  value,
  onChange,
  placeholder = "Buscar...",
  emptyMessage = "Nenhum resultado.",
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [rect, setRect] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, query]);

  function updatePosition() {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.bottom + 4, left: r.left, width: r.width });
  }

  function openDropdown() {
    updatePosition();
    setQuery("");
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  React.useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onReposition() {
      updatePosition();
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open]);

  return (
    <div ref={triggerRef}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openDropdown())}
        className={cn(
          "w-full flex items-center justify-between py-2 px-3 text-sm rounded-lg border border-input bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-left",
          className
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
        </span>
        <Search size={14} className="text-muted-foreground shrink-0 ml-2" />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width }}
            className="z-50 rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
          >
            <div className="p-1.5 border-b border-border">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Digite para buscar..."
                className="w-full px-2 py-1.5 text-sm bg-transparent focus:outline-none"
              />
            </div>
            <div className="max-h-60 overflow-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-sm text-muted-foreground">{emptyMessage}</p>
              ) : (
                filtered.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className="w-full flex flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-accent"
                  >
                    <span className="flex items-center gap-1.5 text-sm text-foreground">
                      {opt.value === value && <Check size={13} className="shrink-0" />}
                      {opt.label}
                    </span>
                    {opt.sublabel && (
                      <span className="font-mono-table text-xs text-muted-foreground truncate w-full">
                        {opt.sublabel}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export { Combobox };
