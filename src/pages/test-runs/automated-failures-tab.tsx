import * as React from "react";
import { supabase } from "@/lib/supabase";
import { AutomatedFailuresList, type FailureRow } from "@/pages/test-runs/automated-failures-list";

interface AutomatedFailuresTabProps {
  runId: string;
}

function AutomatedFailuresTab({ runId }: AutomatedFailuresTabProps) {
  const [failures, setFailures] = React.useState<FailureRow[] | null>(null);

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

  return <AutomatedFailuresList failures={failures} onReload={load} showRunColumn={false} />;
}

export { AutomatedFailuresTab };
