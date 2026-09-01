import { PieChart, Pie, Cell, Legend, ResponsiveContainer } from "recharts";
import { StatCard } from "@/pages/dashboard/stat-card";
import { statusLabel } from "@/lib/labels";
import type { DashboardData } from "@/pages/dashboard/use-dashboard-data";

const RESULT_COLORS: Record<string, string> = {
  passed: "#0ea58e",
  failed: "#dc2626",
  blocked: "#f59e0b",
  skipped: "#94a3b8",
  pre_existing: "#8b5cf6",
  untested: "#e5e5e5",
};

interface OverviewTabProps {
  data: DashboardData;
  inRange: (iso: string | null) => boolean;
}

function OverviewTab({ data, inRange }: OverviewTabProps) {
  const { cases, runs, runCases } = data;

  const executedInRange = runCases.filter((rc) => rc.status !== "untested" && inRange(rc.executed_at));
  const passedInRange = executedInRange.filter((rc) => rc.status === "passed").length;
  const passRate = executedInRange.length ? Math.round((passedInRange / executedInRange.length) * 100) : null;

  const activeRuns = runs.filter((r) => r.status === "active");
  const activeRunCases = runCases.filter((rc) => activeRuns.some((r) => r.id === rc.test_run_id));
  const activeExecuted = activeRunCases.filter((rc) => rc.status !== "untested").length;
  const progressPct = activeRunCases.length ? Math.round((activeExecuted / activeRunCases.length) * 100) : 0;

  const automatedCases = cases.filter((c) => c.automation_status === "automated").length;
  const automationPct = cases.length ? Math.round((automatedCases / cases.length) * 100) : 0;

  const statusCounts: Record<string, number> = { passed: 0, failed: 0, blocked: 0, skipped: 0, pre_existing: 0, untested: 0 };
  runCases
    .filter((rc) => inRange(rc.executed_at) || (rc.status === "untested" && activeRuns.some((r) => r.id === rc.test_run_id)))
    .forEach((rc) => {
      statusCounts[rc.status] = (statusCounts[rc.status] ?? 0) + 1;
    });
  const chartData = Object.entries(statusCounts)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ key, label: statusLabel(key), value }));

  const passColor =
    passRate === null ? undefined : passRate >= 80 ? "text-emerald-600" : passRate >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Taxa de aprovação"
          value={passRate === null ? "—" : `${passRate}%`}
          colorClassName={passColor}
          delta={`${executedInRange.length} execução(ões) de caso no período`}
          info={{
            name: "Taxa de aprovação",
            objective: "Mostrar a saúde geral dos testes executados no período.",
            rule: '(Casos com status "Passou" ÷ Total de casos executados no período) × 100. Ignora casos não testados.',
          }}
        />
        <StatCard
          label="Execuções ativas agora"
          value={activeRuns.length}
          delta={`${runs.length} execução(ões) no total`}
          info={{
            name: "Execuções ativas agora",
            objective: "Saber quantas execuções estão em andamento neste momento.",
            rule: 'Contagem de execuções com status "Ativo". Não é afetado pelo filtro de data — é sempre o estado atual.',
          }}
        />
        <StatCard
          label="Progresso de execução"
          value={`${progressPct}%`}
          delta={`${activeExecuted} de ${activeRunCases.length} casos executados`}
          info={{
            name: "Progresso de execução",
            objective: "Acompanhar o quanto já foi testado nas execuções em andamento.",
            rule: "(Casos já executados ÷ Total de casos) × 100, somando todas as execuções ativas. Não é afetado pelo filtro de data.",
          }}
        />
        <StatCard
          label="Cobertura de automação"
          value={`${automationPct}%`}
          delta={`${automatedCases} automatizado(s) de ${cases.length} caso(s)`}
          info={{
            name: "Cobertura de automação",
            objective: "Entender quanto do repositório de testes já está automatizado, pra priorizar investimento.",
            rule: '(Casos com automação "Automatizado" ÷ Total de casos do repositório) × 100. Reflete o estado atual do repositório, não é afetado pelo filtro de data.',
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Progresso por execução ativa</h3>
          {activeRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma execução ativa no momento.</p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {activeRuns.map((r) => {
                const rcs = runCases.filter((rc) => rc.test_run_id === r.id);
                const done = rcs.filter((rc) => rc.status !== "untested").length;
                const pct = rcs.length ? Math.round((done / rcs.length) * 100) : 0;
                return (
                  <div key={r.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-foreground">{r.title}</span>
                      <span className="text-muted-foreground">
                        {done}/{rcs.length} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Distribuição de resultados</h3>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="label" innerRadius={60} outerRadius={90} paddingAngle={1}>
                  {chartData.map((d) => (
                    <Cell key={d.key} fill={RESULT_COLORS[d.key]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

export { OverviewTab };
