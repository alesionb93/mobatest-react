import * as React from "react";
import { Download, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/contexts/project-context";
import { AutomatedFailuresList, type FailureRow } from "@/pages/test-runs/automated-failures-list";
import { exportFailuresToCSV, exportFailuresToPDF } from "@/lib/automated-failures";
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
  const [selected, setSelected] = React.useState<FailureRow[]>([]);

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
  const exportTargets = selected.length > 0 ? selected : filtered;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
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
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={exportTargets.length === 0}
            onClick={() =>
              exportFailuresToCSV(exportTargets, `falhas-automatizadas-${activeProject?.code ?? "projeto"}.csv`)
            }
          >
            <Download size={14} /> Exportar CSV{selected.length > 0 ? ` (${selected.length})` : ""}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={exportTargets.length === 0}
            onClick={() => exportFailuresToPDF(exportTargets, `Falhas automatizadas — ${activeProject?.name ?? ""}`)}
          >
            <FileText size={14} /> Exportar PDF{selected.length > 0 ? ` (${selected.length})` : ""}
          </Button>
        </div>
      </div>

      {selected.length === 0 && filtered.length > 5 && (
        <p className="text-xs text-muted-foreground -mt-2">
          Nada selecionado — exportando todas as {filtered.length} falhas visíveis. Marque os checkboxes pra exportar
          só algumas (evita PDFs enormes).
        </p>
      )}

      <AutomatedFailuresList failures={filtered} onReload={load} showRunColumn onSelectionChange={setSelected} />
    </div>
  );
}

export { AutomatedFailuresPage };
