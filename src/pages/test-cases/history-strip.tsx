import { statusBadgeVariant, statusLabel } from "@/lib/labels";
import type { RunCaseStatus } from "@/types/test-cases";
import { cn } from "@/lib/utils";

const DOT_COLOR: Record<string, string> = {
  success: "bg-emerald-500",
  danger: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
  neutral: "bg-slate-300",
};

function HistoryStrip({ results }: { results: RunCaseStatus[] }) {
  const last = results.slice(-8);
  if (last.length === 0) {
    return <span className="text-xs text-muted-foreground">sem histórico</span>;
  }
  return (
    <div className="flex items-center gap-1">
      {last.map((status, i) => (
        <span
          key={i}
          title={statusLabel(status)}
          className={cn("h-2 w-2 rounded-full", DOT_COLOR[statusBadgeVariant(status)])}
        />
      ))}
    </div>
  );
}

export { HistoryStrip };
