import { StatCard } from "@/pages/dashboard/stat-card";
import { MetricList } from "@/pages/dashboard/metric-list";
import { formatDurationLong } from "@/lib/format";
import type { DashboardData } from "@/pages/dashboard/use-dashboard-data";

interface RunsTabProps {
  data: DashboardData;
  inRange: (iso: string | null) => boolean;
}

function RunsTab({ data, inRange }: RunsTabProps) {
  const { runs, runCases, profiles, cancellationReasons } = data;

  const completedInRange = runs.filter((r) => r.status === "completed" && r.completed_at && inRange(r.completed_at));
  const avgRunMs = completedInRange.length
    ? completedInRange.reduce(
        (sum, r) => sum + (new Date(r.completed_at!).getTime() - new Date(r.created_at).getTime()),
        0
      ) / completedInRange.length
    : null;

  const successfulRuns = completedInRange.filter((r) => {
    const rcs = runCases.filter((rc) => rc.test_run_id === r.id);
    return rcs.length > 0 && !rcs.some((rc) => rc.status === "failed");
  });
  const successRate = completedInRange.length ? Math.round((successfulRuns.length / completedInRange.length) * 100) : null;

  const profileMap: Record<string, string> = {};
  profiles.forEach((p) => (profileMap[p.id] = p.full_name ?? ""));
  const byPerson: Record<string, number> = {};
  runCases
    .filter((rc) => rc.status !== "untested" && inRange(rc.executed_at))
    .forEach((rc) => {
      const name = (rc.executed_by && profileMap[rc.executed_by]) || "Desconhecido";
      byPerson[name] = (byPerson[name] ?? 0) + 1;
    });

  const cancelledInRange = runs.filter((r) => r.status === "cancelled" && r.completed_at && inRange(r.completed_at));
  const cancelReasonMap: Record<string, string> = {};
  cancellationReasons.forEach((r) => (cancelReasonMap[r.id] = r.label ?? ""));
  const byCancelReason: Record<string, number> = {};
  cancelledInRange.forEach((r) => {
    const label = r.cancellation_reason_id ? cancelReasonMap[r.cancellation_reason_id] || "Motivo removido" : "Sem motivo registrado";
    byCancelReason[label] = (byCancelReason[label] ?? 0) + 1;
  });

  const successColor =
    successRate === null ? undefined : successRate >= 80 ? "text-emerald-600" : successRate >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Tempo médio das execuções"
          value={avgRunMs === null ? "—" : formatDurationLong(Math.round(avgRunMs / 1000))}
          delta={`${completedInRange.length} execução(ões) concluída(s) no período`}
          info={{
            name: "Tempo médio das execuções",
            objective: "Entender quanto tempo, em média, uma rodada de testes leva do início à conclusão.",
            rule: 'Média de (data de conclusão − data de criação), considerando só execuções com status "Concluído" cuja conclusão caiu dentro do período filtrado.',
          }}
        />
        <StatCard
          label="Taxa de sucesso nas execuções"
          value={successRate === null ? "—" : `${successRate}%`}
          colorClassName={successColor}
          delta={`${successfulRuns.length} de ${completedInRange.length} sem nenhuma falha`}
          info={{
            name: "Taxa de sucesso nas execuções",
            objective:
              "Ver quantas rodadas de teste terminaram totalmente limpas, sem nenhum caso falho — diferente da taxa de aprovação, que olha caso a caso.",
            rule: '(Execuções concluídas sem nenhum caso "Falhou" ÷ Total de execuções concluídas no período) × 100.',
          }}
        />
        <StatCard
          label="Execuções canceladas"
          value={cancelledInRange.length}
          colorClassName={cancelledInRange.length > 0 ? "text-amber-600" : undefined}
          delta={`de ${completedInRange.length + cancelledInRange.length} execução(ões) finalizada(s) no período`}
          info={{
            name: "Execuções canceladas",
            objective:
              "Acompanhar quantas execuções foram interrompidas antes de terminar, e por quê — ajuda a identificar problemas recorrentes de ambiente, planejamento ou escopo.",
            rule: 'Contagem de execuções com status "Cancelado" cuja data de cancelamento caiu dentro do período filtrado.',
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Testes por pessoa</h3>
          <MetricList rows={Object.entries(byPerson).sort((a, b) => b[1] - a[1])} />
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Motivos de cancelamento</h3>
          <MetricList
            rows={Object.entries(byCancelReason).sort((a, b) => b[1] - a[1])}
            emptyMessage="Nenhuma execução cancelada no período."
          />
        </div>
      </div>
    </div>
  );
}

export { RunsTab };
