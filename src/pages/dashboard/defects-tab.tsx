import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, Legend, ResponsiveContainer } from "recharts";
import { StatCard } from "@/pages/dashboard/stat-card";
import { MetricList } from "@/pages/dashboard/metric-list";
import { formatDurationLong } from "@/lib/format";
import type { DashboardData } from "@/pages/dashboard/use-dashboard-data";

const REASON_COLORS = ["#0ea58e", "#3b82f6", "#f97316", "#8b5cf6", "#ec4899", "#94a3b8"];

interface DefectsTabProps {
  data: DashboardData;
  inRange: (iso: string | null) => boolean;
}

function DefectsTab({ data, inRange }: DefectsTabProps) {
  const { defects, cases, suites, reasons, contacts, runCases, runs } = data;
  const defectsInRange = defects.filter((d) => inRange(d.created_at));

  const caseSuiteMap: Record<string, string> = {};
  cases.forEach((c) => {
    if (c.suite_id) caseSuiteMap[c.id] = c.suite_id;
  });
  const casesPerSuite: Record<string, number> = {};
  cases.forEach((c) => {
    if (c.suite_id) casesPerSuite[c.suite_id] = (casesPerSuite[c.suite_id] ?? 0) + 1;
  });
  const defectsPerSuite: Record<string, number> = {};
  defectsInRange.forEach((d) => {
    const suiteId = d.test_case_id ? caseSuiteMap[d.test_case_id] : undefined;
    if (suiteId) defectsPerSuite[suiteId] = (defectsPerSuite[suiteId] ?? 0) + 1;
  });
  const densityRows = suites
    .filter((s) => defectsPerSuite[s.id])
    .map((s) => ({
      title: s.title,
      density: Math.round((defectsPerSuite[s.id] / (casesPerSuite[s.id] ?? 1)) * 100) / 100,
      count: defectsPerSuite[s.id],
    }))
    .sort((a, b) => b.density - a.density)
    .slice(0, 8);

  const resolvedInRange = defectsInRange.filter((d) => d.resolved_at && inRange(d.resolved_at));
  const avgResolutionMs = resolvedInRange.length
    ? resolvedInRange.reduce(
        (sum, d) => sum + (new Date(d.resolved_at!).getTime() - new Date(d.created_at).getTime()),
        0
      ) / resolvedInRange.length
    : null;

  const reasonMap: Record<string, string> = {};
  reasons.forEach((r) => (reasonMap[r.id] = r.label ?? ""));
  const byReason: Record<string, number> = {};
  defectsInRange.forEach((d) => {
    const label = d.failure_reason_id ? reasonMap[d.failure_reason_id] || "Motivo removido" : "Sem motivo definido";
    byReason[label] = (byReason[label] ?? 0) + 1;
  });
  const reasonChartData = Object.entries(byReason).map(([label, value]) => ({ label, value }));

  const contactMap: Record<string, string> = {};
  contacts.forEach((c) => (contactMap[c.id] = c.name ?? ""));
  const byDev: Record<string, number> = {};
  defectsInRange.forEach((d) => {
    const label = d.dev_contact_id ? contactMap[d.dev_contact_id] || "Contato removido" : "Sem dev atribuído";
    byDev[label] = (byDev[label] ?? 0) + 1;
  });
  const byPo: Record<string, number> = {};
  defectsInRange.forEach((d) => {
    const label = d.po_contact_id ? contactMap[d.po_contact_id] || "Contato removido" : "Sem PO atribuído";
    byPo[label] = (byPo[label] ?? 0) + 1;
  });

  const runCaseToRunId: Record<string, string> = {};
  runCases.forEach((rc) => (runCaseToRunId[rc.id] = rc.test_run_id));
  const runEnv: Record<string, string | null> = {};
  runs.forEach((r) => (runEnv[r.id] = r.environment));
  const prodDefects = defectsInRange.filter((d) => {
    if (!d.test_run_case_id) return false;
    const runId = runCaseToRunId[d.test_run_case_id];
    return runId && runEnv[runId] === "Produção";
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Tempo médio de resolução"
          value={avgResolutionMs === null ? "—" : formatDurationLong(Math.round(avgResolutionMs / 1000))}
          delta={`${resolvedInRange.length} defeito(s) resolvido(s) no período`}
          info={{
            name: "Tempo médio de resolução",
            objective: "Medir a velocidade de reação do time a bugs encontrados.",
            rule: "Média de (data em que virou Resolvido/Fechado − data de criação), considerando só defeitos resolvidos dentro do período filtrado.",
          }}
        />
        <StatCard
          label="Defeitos escapados para produção"
          value={prodDefects.length}
          colorClassName={prodDefects.length > 0 ? "text-red-600" : "text-emerald-600"}
          delta={`de ${defectsInRange.length} defeito(s) no período`}
          info={{
            name: "Defeitos escapados para produção",
            objective: "Identificar bugs que só foram pegos depois de já estarem no ar, não durante o teste em homologação.",
            rule: 'Contagem de defeitos vinculados a um caso de execução cuja execução tinha o Ambiente marcado como "Produção", criados dentro do período filtrado.',
          }}
        />
        <StatCard
          label="Defeitos no período"
          value={defectsInRange.length}
          delta={`${defects.length} no total (sem filtro)`}
          info={{
            name: "Defeitos no período",
            objective: "Referência rápida do volume de defeitos abertos no período selecionado.",
            rule: "Contagem de defeitos cuja data de criação está dentro do período filtrado.",
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center">Densidade de defeitos por suíte</h3>
          {densityRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados suficientes no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={densityRows} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.5} />
                <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="title" tick={{ fontSize: 11 }} width={100} axisLine={false} tickLine={false} />
                <Bar dataKey="density" fill="#dc2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Motivo de falhas</h3>
          {reasonChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={reasonChartData} dataKey="value" nameKey="label" innerRadius={50} outerRadius={85}>
                  {reasonChartData.map((_, i) => (
                    <Cell key={i} fill={REASON_COLORS[i % REASON_COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Desenvolvedor responsável</h3>
          <MetricList rows={Object.entries(byDev).sort((a, b) => b[1] - a[1]).slice(0, 8)} />
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">PO responsável</h3>
          <MetricList rows={Object.entries(byPo).sort((a, b) => b[1] - a[1]).slice(0, 8)} />
        </div>
      </div>
    </div>
  );
}

export { DefectsTab };
