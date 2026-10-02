import * as React from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/contexts/project-context";
import type { TestRunListItem } from "@/types/test-runs";

export function useTestRunsList() {
  const { activeProject } = useProject();
  const [runs, setRuns] = React.useState<TestRunListItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!activeProject) {
      setRuns([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("test_runs")
      .select("*, test_run_cases(status)")
      .eq("project_id", activeProject.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar execuções: " + error.message);
    setRuns((data as TestRunListItem[]) ?? []);
    setLoading(false);
  }, [activeProject]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function deleteRun(id: string) {
    const { error } = await supabase.from("test_runs").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir execução: " + error.message);
      return;
    }
    toast.success("Execução excluída.");
    await load();
  }

  return { loading, runs, reload: load, deleteRun };
}
