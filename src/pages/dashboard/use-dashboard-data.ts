import * as React from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/contexts/project-context";

export interface DashCase {
  id: string;
  suite_id: string | null;
  automation_status: string;
}
export interface DashSuite {
  id: string;
  title: string;
}
export interface DashRun {
  id: string;
  title: string;
  status: string;
  environment: string | null;
  created_at: string;
  completed_at: string | null;
  cancellation_reason_id: string | null;
}
export interface DashDefect {
  id: string;
  test_case_id: string | null;
  test_run_case_id: string | null;
  created_at: string;
  resolved_at: string | null;
  failure_reason_id: string | null;
  dev_contact_id: string | null;
  po_contact_id: string | null;
}
export interface DashRunCase {
  id: string;
  status: string;
  executed_by: string | null;
  executed_at: string | null;
  test_run_id: string;
}
export interface DashLookup {
  id: string;
  label?: string;
  name?: string;
  full_name?: string;
}

export interface DashboardData {
  cases: DashCase[];
  suites: DashSuite[];
  runs: DashRun[];
  defects: DashDefect[];
  reasons: DashLookup[];
  contacts: DashLookup[];
  profiles: DashLookup[];
  runCases: DashRunCase[];
  cancellationReasons: DashLookup[];
}

export function useDashboardData() {
  const { activeProject } = useProject();
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!activeProject) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    const [casesRes, suitesRes, runsRes, defectsRes, reasonsRes, contactsRes, profilesRes, cancellationRes] =
      await Promise.all([
        supabase.from("test_cases").select("id, suite_id, automation_status").eq("project_id", activeProject.id),
        supabase.from("test_suites").select("id, title").eq("project_id", activeProject.id),
        supabase
          .from("test_runs")
          .select("id, title, status, environment, created_at, completed_at, cancellation_reason_id")
          .eq("project_id", activeProject.id)
          .order("created_at", { ascending: false }),
        supabase.from("defects").select("*").eq("project_id", activeProject.id),
        supabase.from("failure_reasons").select("id, label"),
        supabase.from("contacts").select("id, name, kind"),
        supabase.from("profiles").select("id, full_name"),
        supabase.from("cancellation_reasons").select("id, label"),
      ]);

    const runIds = (runsRes.data ?? []).map((r) => r.id);
    const runCasesRes = runIds.length
      ? await supabase.from("test_run_cases").select("id, status, executed_by, executed_at, test_run_id").in("test_run_id", runIds)
      : { data: [] };

    setData({
      cases: (casesRes.data as DashCase[]) ?? [],
      suites: (suitesRes.data as DashSuite[]) ?? [],
      runs: (runsRes.data as DashRun[]) ?? [],
      defects: (defectsRes.data as DashDefect[]) ?? [],
      reasons: (reasonsRes.data as DashLookup[]) ?? [],
      contacts: (contactsRes.data as DashLookup[]) ?? [],
      profiles: (profilesRes.data as DashLookup[]) ?? [],
      runCases: (runCasesRes.data as DashRunCase[]) ?? [],
      cancellationReasons: (cancellationRes.data as DashLookup[]) ?? [],
    });
    setLoading(false);
  }, [activeProject]);

  React.useEffect(() => {
    load();
  }, [load]);

  return { loading, data, reload: load };
}
