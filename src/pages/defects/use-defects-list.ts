import * as React from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/contexts/project-context";
import type { Defect } from "@/types/defects";

export function useDefectsList() {
  const { activeProject } = useProject();
  const [defects, setDefects] = React.useState<Defect[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!activeProject) {
      setDefects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("defects")
      .select("*, test_cases(title, seq)")
      .eq("project_id", activeProject.id)
      .order("created_at", { ascending: false });
    if (error) toast.error("Erro ao carregar defeitos: " + error.message);
    setDefects((data as Defect[]) ?? []);
    setLoading(false);
  }, [activeProject]);

  React.useEffect(() => {
    load();
  }, [load]);

  return { loading, defects, reload: load };
}
