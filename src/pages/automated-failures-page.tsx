import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/contexts/project-context";
import { AutomatedFailuresList, type FailureRow } from "@/pages/test-runs/automated-failures-list";
import type { AutomatedFailure } from "@/types/test-runs";

const FILTERS: { key: AutomatedFailure["status"] | "all"; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "new", label: "Novas" },
  { key: "flaky", label: "Flaky" },
  { key: "promoted", label: "Viraram defeito" },
];

function AutomatedFailuresPage() {
  const { activeProject } = useProject();
  const [failures, setFailures] = React.useState<FailureRow[] | null>(null);
  const [filter, setFilter] = React.useState<AutomatedFailure["status"] | "all">("all");

  const load = React.useCallback(async () => {
    if (!activeProject) return;
    const { data } = await supabase
      .from("automated_failures")
      .select("*, test_run_case:test_run_cases(id, test_case_id, test_run_id, test_run:test_runs(title))")
      .eq("project_id", activeProject.id)
      .order("occurred_at", { ascending: false });
    setFailures((data as FailureRow[]) ?? []);
  }, [activeProject]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (failures === null) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const filtered = filter === "all" ? failures : failures.filter((f) => f.status === filter);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label} ({f.key === "all" ? failures.length : failures.filter((x) => x.status === f.key).length})
          </button>
        ))}
      </div>

      <AutomatedFailuresList failures={filtered} onReload={load} showRunColumn />
    </div>
  );
}

export { AutomatedFailuresPage };
