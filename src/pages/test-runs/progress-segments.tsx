const COLORS: Record<string, string> = {
  passed: "bg-emerald-500",
  failed: "bg-red-500",
  blocked: "bg-amber-500",
  skipped: "bg-slate-400",
  pre_existing: "bg-violet-500",
  untested: "bg-muted",
};

function ProgressSegments({ statuses }: { statuses: (string | null)[] }) {
  const total = statuses.length || 1;
  const counts: Record<string, number> = {
    passed: 0,
    failed: 0,
    blocked: 0,
    skipped: 0,
    pre_existing: 0,
    untested: 0,
  };
  statuses.forEach((s) => {
    const key = s || "untested";
    counts[key] = (counts[key] ?? 0) + 1;
  });

  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
      {Object.entries(counts).map(([key, value]) =>
        value > 0 ? (
          <span key={key} className={COLORS[key]} style={{ width: `${(value / total) * 100}%` }} />
        ) : null
      )}
    </div>
  );
}

export { ProgressSegments };
