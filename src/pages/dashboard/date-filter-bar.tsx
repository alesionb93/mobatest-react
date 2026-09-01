import * as React from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export type PresetKey = "all" | "7" | "30" | "90" | null;

interface DateFilterBarProps {
  dateFrom: string | null;
  dateTo: string | null;
  preset: PresetKey;
  onChangePreset: (preset: PresetKey) => void;
  onChangeRange: (from: string | null, to: string | null) => void;
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDateBR(iso: string | null) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function buildCalendarCells(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { iso: string; day: number; otherMonth: boolean }[] = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    cells.push({ iso: isoDate(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, d), day: d, otherMonth: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: isoDate(year, month, d), day: d, otherMonth: false });
  }
  while (cells.length % 7 !== 0) {
    const d = cells.length - (startWeekday + daysInMonth) + 1;
    cells.push({ iso: isoDate(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1, d), day: d, otherMonth: true });
  }
  return cells;
}

function DateFilterBar({ dateFrom, dateTo, preset, onChangePreset, onChangeRange }: DateFilterBarProps) {
  const [open, setOpen] = React.useState(false);
  const [viewDate, setViewDate] = React.useState(() => (dateFrom ? new Date(dateFrom + "T00:00:00") : new Date()));
  const [pendingFrom, setPendingFrom] = React.useState<string | null>(dateFrom);
  const [pendingTo, setPendingTo] = React.useState<string | null>(dateTo);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function openPopover() {
    setPendingFrom(dateFrom);
    setPendingTo(dateTo);
    setViewDate(dateFrom ? new Date(dateFrom + "T00:00:00") : new Date());
    setOpen(true);
  }

  function handleDayClick(iso: string) {
    if (!pendingFrom || (pendingFrom && pendingTo)) {
      setPendingFrom(iso);
      setPendingTo(null);
    } else if (iso < pendingFrom) {
      setPendingFrom(iso);
    } else {
      setPendingTo(iso);
    }
  }

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const cells = buildCalendarCells(year, month);

  return (
    <div className="flex items-center gap-2 flex-wrap relative" ref={rootRef}>
      {(["all", "7", "30", "90"] as const).map((p) => (
        <button
          key={p}
          onClick={() => onChangePreset(p)}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium border",
            preset === p ? "bg-secondary border-border text-foreground" : "border-transparent text-muted-foreground hover:bg-muted"
          )}
        >
          {p === "all" ? "Tudo" : `${p} dias`}
        </button>
      ))}
      <button
        onClick={() => (open ? setOpen(false) : openPopover())}
        className="flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-1.5 text-sm hover:bg-secondary"
      >
        <Calendar size={14} />
        {dateFrom && dateTo ? `${formatDateBR(dateFrom)} – ${formatDateBR(dateTo)}` : "Selecionar período"}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-40 w-72 rounded-lg border border-border bg-popover shadow-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="text-muted-foreground hover:text-foreground p-1">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium text-foreground">
              {MONTH_LABELS[month]} de {year}
            </span>
            <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="text-muted-foreground hover:text-foreground p-1">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_LABELS.map((w) => (
              <span key={w} className="text-center text-[10px] text-muted-foreground">
                {w}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((c) => {
              const isStart = c.iso === pendingFrom;
              const isEnd = c.iso === pendingTo;
              const inRangeCell = pendingFrom && pendingTo && c.iso > pendingFrom && c.iso < pendingTo;
              return (
                <button
                  key={c.iso}
                  onClick={() => handleDayClick(c.iso)}
                  className={cn(
                    "h-7 w-7 text-xs rounded-md",
                    c.otherMonth && "text-muted-foreground/40",
                    !c.otherMonth && "text-foreground",
                    (isStart || isEnd) && "bg-primary text-primary-foreground",
                    inRangeCell && "bg-accent",
                    !isStart && !isEnd && !inRangeCell && "hover:bg-muted"
                  )}
                >
                  {c.day}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {pendingFrom ? formatDateBR(pendingFrom) : "—"} – {pendingTo ? formatDateBR(pendingTo) : "—"}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onChangeRange(null, null);
                  onChangePreset("all");
                  setOpen(false);
                }}
              >
                Limpar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onChangeRange(pendingFrom, pendingTo || pendingFrom);
                  onChangePreset(null);
                  setOpen(false);
                }}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { DateFilterBar };
