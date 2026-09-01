import * as React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Cell, ResponsiveContainer } from "recharts";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/contexts/project-context";
import { Skeleton } from "@/components/ui/skeleton";
import { statusLabel } from "@/lib/labels";

const PRIORITY_COLORS = ["#94a3b8", "#3b82f6", "#f59e0b", "#dc2626"];
const PALETTE = ["#3b82f6", "#8b5cf6", "#0ea58e", "#dc2626", "#f59e0b", "#171717", "#94a3b8", "#737373", "#e5e5e5"];

interface CaseRow {
  priority: string;
  type: string;
  automation_status: string;
}
interface DefectRow {
  severity: string;
}
interface RunRow {
  id: string;
  title: string;
  created_at: string;
  test_run_cases: { status: string }[];
}

function groupBy<T>(arr: T[], key: keyof T) {
  const counts: Record<string, number> = {};
  arr.forEach((item) => {
    const k = (item[key] as unknown as string) || "other";
    counts[k] = (counts[k] ?? 0) + 1;
  });
  return counts;
}

function ReportsPage() {
  const { activeProject } = useProject();
  const [cases, setCases] = React.useState<CaseRow[]>([]);
  const [defects, setDefects] = React.useState<DefectRow[]>([]);
  const [runs, setRuns] = React.useState<RunRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!activeProject) return;
    setLoading(true);
    Promise.all([
      supabase.from("test_cases").select("priority, type, automation_status").eq("project_id", activeProject.id),
      supabase.from("defects").select("severity").eq("project_id", activeProject.id),
      supabase
        .from("test_runs")
        .select("id, title, created_at, test_run_cases(status)")
        .eq("project_id", activeProject.id)
        .order("created_at"),
    ]).then(([casesRes, defectsRes, runsRes]) => {
      setCases((casesRes.data as CaseRow[]) ?? []);
      setDefects((defectsRes.data as DefectRow[]) ?? []);
      setRuns((runsRes.data as RunRow[]) ?? []);
      setLoading(false);
    });
  }, [activeProject]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const priorityData = Object.entries(groupBy(cases, "priority")).map(([key, value]) => ({
    label: statusLabel(key),
    value,
  }));
  const typeData = Object.entries(groupBy(cases, "type")).map(([key, value]) => ({ label: statusLabel(key), value }));
  const severityData = Object.entries(groupBy(defects, "severity")).map(([key, value]) => ({
    label: statusLabel(key),
    value,
  }));
  const runRates = runs.map((r) => {
    const rcs = r.test_run_cases ?? [];
    const executed = rcs.filter((rc) => rc.status !== "untested");
    const passed = rcs.filter((rc) => rc.status === "passed");
    return { label: r.title, rate: executed.length ? Math.round((passed.length / executed.length) * 100) : 0 };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="Casos de teste por prioridade">
        {priorityData.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={priorityData}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {priorityData.map((_, i) => (
                  <Cell key={i} fill={PRIORITY_COLORS[i % PRIORITY_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Casos de teste por tipo">
        {typeData.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={typeData}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {typeData.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Defeitos por severidade">
        {severityData.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={severityData}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {severityData.map((_, i) => (
                  <Cell key={i} fill={PRIORITY_COLORS[i % PRIORITY_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Taxa de aprovação por execução">
        {runRates.length === 0 ? (
          <EmptyChart message="Nenhuma execução registrada ainda." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={runRates}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="rate" stroke="#309ddd" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart({ message = "Sem dados suficientes ainda." }: { message?: string }) {
  return <p className="text-sm text-muted-foreground py-16 text-center">{message}</p>;
}

export { ReportsPage };
