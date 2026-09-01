import { PieChart, Pie, Cell } from "recharts";
import type { TestRunCase } from "@/types/test-runs";

const COLORS: Record<string, string> = {
  passed: "#0ea58e",
  failed: "#dc2626",
  blocked: "#f59e0b",
  skipped: "#94a3b8",
  pre_existing: "#8b5cf6",
  untested: "#e5e5e5",
};

function RunProgressDonut({ runCases }: { runCases: TestRunCase[] }) {
  const counts: Record<string, number> = {
    passed: 0,
    failed: 0,
    blocked: 0,
    skipped: 0,
    pre_existing: 0,
    untested: 0,
  };
  runCases.forEach((rc) => {
    const s = rc.status || "untested";
    counts[s] = (counts[s] ?? 0) + 1;
  });
  const total = runCases.length || 1;
  const executed = runCases.filter((rc) => rc.status && rc.status !== "untested").length;
  const pct = Math.round((executed / total) * 100);

  const data = Object.entries(counts)
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({ key, value }));

  return (
    <div className="relative mx-auto" style={{ width: 150, height: 150 }}>
      <PieChart width={150} height={150}>
        <Pie data={data} dataKey="value" innerRadius={54} outerRadius={72} stroke="none">
          {data.map((entry) => (
            <Cell key={entry.key} fill={COLORS[entry.key]} />
          ))}
        </Pie>
      </PieChart>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-foreground">{pct}%</span>
        <span className="text-xs text-muted-foreground">concluído</span>
      </div>
    </div>
  );
}

export { RunProgressDonut };
