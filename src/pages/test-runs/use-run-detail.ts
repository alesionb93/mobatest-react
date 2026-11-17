import * as React from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/contexts/project-context";
import { useAuth } from "@/contexts/auth-context";
import { buildReviewPatch, type ReviewInput } from "@/lib/run-review";
import { collectEvidencePaths, removeEvidenceFiles } from "@/lib/run-case-evidences";
import type { TestRun, TestRunCase, RunDefect, Profile } from "@/types/test-runs";
import type { TestSuite } from "@/types/test-cases";

export function useRunDetail(runId: string | undefined) {
  const { activeProject } = useProject();
  const { user } = useAuth();
  const [run, setRun] = React.useState<TestRun | null>(null);
  const [runCases, setRunCases] = React.useState<TestRunCase[]>([]);
  const [suites, setSuites] = React.useState<TestSuite[]>([]);
  const [defects, setDefects] = React.useState<RunDefect[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, Profile>>({});
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [devName, setDevName] = React.useState<string | null>(null);
  const hasLoadedOnceRef = React.useRef(false);

  const load = React.useCallback(async () => {
    if (!runId || !activeProject) return;
    // Só mostra o skeleton de tela cheia na primeira carga. Recarregamentos
    // seguintes (ex: depois de marcar um status, ou ao fim de uma execução
    // em lote) atualizam os dados em segundo plano — sem isso, a página
    // inteira "piscava" pro estado de loading e desmontava qualquer modal
    // aberto por cima (foi a causa do bug da execução em lote reiniciar).
    if (!hasLoadedOnceRef.current) setLoading(true);
    setNotFound(false);

    const [runRes, runCasesRes, suitesRes] = await Promise.all([
      supabase.from("test_runs").select("*").eq("id", runId).single(),
      supabase
        .from("test_run_cases")
        .select("*, test_cases(title, seq, priority, suite_id, automation_status, automation_script_path)")
        .eq("test_run_id", runId),
      supabase.from("test_suites").select("*").eq("project_id", activeProject.id).order("position"),
    ]);

    if (runRes.error || !runRes.data) {
      setNotFound(true);
      setLoading(false);
      hasLoadedOnceRef.current = true;
      return;
    }

    const safeRunCases = (runCasesRes.data as TestRunCase[]) ?? [];
    const runCaseIds = safeRunCases.map((rc) => rc.id);

    const defectsRes = runCaseIds.length
      ? await supabase.from("defects").select("id, seq, title, severity, status, test_run_case_id, dev_contact_id").in("test_run_case_id", runCaseIds)
      : { data: [] as RunDefect[] };

    const userIds = new Set<string>();
    if (runRes.data.created_by) userIds.add(runRes.data.created_by);
    safeRunCases.forEach((rc) => {
      if (rc.assignee_id) userIds.add(rc.assignee_id);
      if (rc.executed_by) userIds.add(rc.executed_by);
    });

    let profilesMap: Record<string, Profile> = {};
    if (userIds.size > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", Array.from(userIds));
      (profilesData ?? []).forEach((p) => (profilesMap[p.id] = p as Profile));
    }

    // O nome do dev responsável pela tarefa (se a execução tem um).
    let devNameFound: string | null = null;
    if (runRes.data.dev_contact_id) {
      const { data: dev } = await supabase.from("contacts").select("name").eq("id", runRes.data.dev_contact_id).maybeSingle();
      devNameFound = (dev as { name: string } | null)?.name ?? null;
    }

    setRun(runRes.data as TestRun);
    setDevName(devNameFound);
    setRunCases(safeRunCases);
    setSuites((suitesRes.data as TestSuite[]) ?? []);
    setDefects((defectsRes.data as RunDefect[]) ?? []);
    setProfiles(profilesMap);
    setLoading(false);
    hasLoadedOnceRef.current = true;
  }, [runId, activeProject]);

  React.useEffect(() => {
    load();
  }, [load]);

  /** Conclui a execução já registrando como a rodada terminou (aprovada, reprovada e devolvida ao dev, ou não se aplica). */
  async function completeRun(review: ReviewInput) {
    if (!run) return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("test_runs")
      .update({ ...buildReviewPatch(review, run, user?.id ?? null, now), status: "completed", completed_at: now })
      .eq("id", run.id);
    if (error) {
      toast.error("Erro ao concluir execução: " + error.message);
      return;
    }
    toast.success("Execução concluída!");
    await load();
  }

  /** Corrige a tarefa, o dev ou o resultado da rodada de uma execução (sem mudar o status dela). */
  async function saveReview(review: ReviewInput) {
    if (!run) return;
    const { error } = await supabase
      .from("test_runs")
      .update(buildReviewPatch(review, run, user?.id ?? null, new Date().toISOString()))
      .eq("id", run.id);
    if (error) {
      toast.error("Erro ao salvar a avaliação: " + error.message);
      return;
    }
    toast.success("Avaliação salva.");
    await load();
  }

  async function cancelRun(reasonId: string) {
    if (!run) return;
    const { error } = await supabase
      .from("test_runs")
      .update({ status: "cancelled", completed_at: new Date().toISOString(), cancellation_reason_id: reasonId })
      .eq("id", run.id);
    if (error) {
      toast.error("Erro ao cancelar execução: " + error.message);
      return;
    }
    toast.success("Execução cancelada.");
    await load();
  }

  async function togglePublic(isPublic: boolean) {
    if (!run) return false;
    const { error } = await supabase.from("test_runs").update({ is_public: isPublic }).eq("id", run.id);
    if (error) {
      toast.error("Erro ao atualizar link público: " + error.message);
      return false;
    }
    setRun({ ...run, is_public: isPublic });
    return true;
  }

  async function ensureReportToken() {
    if (!run) return null;
    if (run.report_token) return run.report_token;
    const token = crypto.randomUUID();
    const { error } = await supabase.from("test_runs").update({ report_token: token }).eq("id", run.id);
    if (error) return null;
    setRun({ ...run, report_token: token });
    return token;
  }

  async function bulkAssign(ids: string[], assigneeId: string | null) {
    const { error } = await supabase.from("test_run_cases").update({ assignee_id: assigneeId }).in("id", ids);
    if (error) {
      toast.error("Erro ao atribuir casos: " + error.message);
      return;
    }
    toast.success(assigneeId ? `${ids.length} caso(s) atribuído(s).` : `${ids.length} caso(s) desatribuído(s).`);
    await load();
  }

  async function bulkRemove(ids: string[]) {
    const evidencePaths = await collectEvidencePaths({ runCaseIds: ids });
    const { error } = await supabase.from("test_run_cases").delete().in("id", ids);
    if (error) {
      toast.error("Erro ao remover casos: " + error.message);
      return;
    }
    await removeEvidenceFiles(evidencePaths);
    toast.success("Casos removidos da execução.");
    await load();
  }

  async function updateReportNotes(notes: string) {
    if (!run) return;
    await supabase.from("test_runs").update({ report_notes: notes }).eq("id", run.id);
    setRun({ ...run, report_notes: notes });
  }

  return {
    loading,
    notFound,
    run,
    runCases,
    suites,
    defects,
    profiles,
    devName,
    reload: load,
    completeRun,
    saveReview,
    cancelRun,
    togglePublic,
    ensureReportToken,
    bulkAssign,
    bulkRemove,
    updateReportNotes,
  };
}
