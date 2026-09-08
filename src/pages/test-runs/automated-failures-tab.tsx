import * as React from "react";
import { Download, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { AutomatedFailuresList, type FailureRow } from "@/pages/test-runs/automated-failures-list";
import { exportFailuresToCSV, exportFailuresToPDF } from "@/lib/automated-failures";

interface AutomatedFailuresTabProps {
  runId: string;
}

function AutomatedFailuresTab({ runId }: AutomatedFailuresTabProps) {
  const [failures, setFailures] = React.useState<FailureRow[] | null>(null);
  const [selected, setSelected] = React.useState<FailureRow[]>([]);

  const load = React.useCallback(async () => {
    const { data } = await supabase
      .from("automated_failures")
      .select("*, test_run_case:test_run_cases!inner(id, test_case_id, test_run_id)")
      .eq("test_run_case.test_run_id", runId)
      .order("occurred_at", { ascending: false });
    setFailures((data as FailureRow[]) ?? []);
  }, [runId]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (failures === null) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  const exportTargets = selected.length > 0 ? selected : failures;

  return (
    <div className="flex flex-col gap-3">
      {failures.length > 0 && (
        <>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportFailuresToCSV(exportTargets, "falhas-automatizadas-execucao.csv")}
            >
              <Download size={14} /> Exportar CSV{selected.length > 0 ? ` (${selected.length})` : ""}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => exportFailuresToPDF(exportTargets, "Falhas automatizadas — Execução")}
            >
              <FileText size={14} /> Exportar PDF{selected.length > 0 ? ` (${selected.length})` : ""}
            </Button>
          </div>
          {selected.length === 0 && failures.length > 5 && (
            <p className="text-xs text-muted-foreground -mt-2 text-right">
              Nada selecionado — exportando todas as {failures.length}. Marque os checkboxes pra exportar só algumas.
            </p>
          )}
        </>
      )}
      <AutomatedFailuresList failures={failures} onReload={load} showRunColumn={false} onSelectionChange={setSelected} />
    </div>
  );
}

export { AutomatedFailuresTab };
