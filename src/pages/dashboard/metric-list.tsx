interface MetricListProps {
  rows: [string, number][];
  emptyMessage?: string;
}

function MetricList({ rows, emptyMessage = "Sem dados no período." }: MetricListProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {rows.map(([name, count]) => (
        <div key={name} className="flex items-center justify-between text-sm">
          <span className="text-foreground truncate">{name}</span>
          <span className="text-muted-foreground font-mono-table">{count}</span>
        </div>
      ))}
    </div>
  );
}

export { MetricList };
