import { Share2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RunProgressDonut } from "@/pages/test-runs/run-progress-donut";
import { formatDuration, formatElapsed, profileName } from "@/pages/test-runs/run-helpers";
import { statusBadgeVariant, statusLabel } from "@/lib/labels";
import type { TestRun, TestRunCase, Profile } from "@/types/test-runs";

interface RunDetailSidebarProps {
  run: TestRun;
  runCases: TestRunCase[];
  profiles: Record<string, Profile>;
  onShare: () => void;
  onExport: () => void;
  onCancel: () => void;
  onComplete: () => void;
}

function RunDetailSidebar({ run, runCases, profiles, onShare, onExport, onCancel, onComplete }: RunDetailSidebarProps) {
  const total = runCases.length || 1;
  const executed = runCases.filter((rc) => rc.status && rc.status !== "untested").length;
  const totalDurationSeconds = runCases.reduce((sum, rc) => sum + (rc.duration_seconds ?? 0), 0);

  return (
    <aside className="w-72 shrink-0 rounded-xl border border-border bg-card p-4 flex flex-col gap-4 h-fit">
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1" onClick={onShare}>
          <Share2 size={14} /> Compartilhar
        </Button>
        <Button variant="secondary" size="sm" className="flex-1" onClick={onExport}>
          <Download size={14} /> Exportar
        </Button>
      </div>

      {run.status === "active" && (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1 justify-center" onClick={onCancel}>
            Cancelar
          </Button>
          <Button className="flex-1 justify-center" onClick={onComplete}>
            Concluir
          </Button>
        </div>
      )}

      <RunProgressDonut runCases={runCases} />
      <p className="text-center text-sm text-muted-foreground -mt-2">
        {executed} de {total === 1 && runCases.length === 0 ? 0 : runCases.length} casos
      </p>

      <div className="flex flex-col gap-3 pt-2 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Status</p>
          <Badge variant={statusBadgeVariant(run.status)}>{statusLabel(run.status)}</Badge>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Iniciado por</p>
          <p className="text-sm font-semibold text-foreground">{profileName(run.created_by, profiles)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Iniciado em</p>
          <p className="text-sm font-semibold text-foreground">{new Date(run.created_at).toLocaleDateString("pt-BR")}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Tempo decorrido</p>
          <p className="text-sm font-semibold text-foreground">{formatElapsed(run.created_at, run.completed_at)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Tempo total testando</p>
          <p className="text-sm font-semibold text-foreground">
            {totalDurationSeconds > 0 ? formatDuration(totalDurationSeconds) : "—"}
          </p>
        </div>
      </div>
    </aside>
  );
}

export { RunDetailSidebar };
