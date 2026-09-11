import * as React from "react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/contexts/project-context";
import type { TestSuite, TestCase, TestCaseInput, RunCaseStatus } from "@/types/test-cases";
import { toast } from "sonner";

export type HistoryByCase = Record<string, RunCaseStatus[]>;

export function useTestCasesData() {
  const { activeProject } = useProject();
  const [suites, setSuites] = React.useState<TestSuite[]>([]);
  const [cases, setCases] = React.useState<TestCase[]>([]);
  const [historyByCase, setHistoryByCase] = React.useState<HistoryByCase>({});
  const [loading, setLoading] = React.useState(true);
  const hasLoadedOnceRef = React.useRef(false);

  const load = React.useCallback(async () => {
    if (!activeProject) {
      setSuites([]);
      setCases([]);
      setHistoryByCase({});
      setLoading(false);
      return;
    }
    // Só mostra a tela de carregamento na primeira vez — recarregar depois de
    // um drag-and-drop, criar suíte, etc. não pode desmontar a árvore inteira
    // (isso resetava o estado de "colapsado" de todo mundo, causando o bug
    // de "reordenei e voltou tudo expandido").
    if (!hasLoadedOnceRef.current) setLoading(true);
    const [suitesRes, casesRes, runCasesRes] = await Promise.all([
      supabase.from("test_suites").select("*").eq("project_id", activeProject.id).order("position"),
      supabase
        .from("test_cases")
        .select("*")
        .eq("project_id", activeProject.id)
        .order("position")
        .order("seq"),
      supabase
        .from("test_run_cases")
        .select("test_case_id, status, executed_at, test_runs!inner(project_id)")
        .eq("test_runs.project_id", activeProject.id)
        .order("executed_at", { ascending: true }),
    ]);

    if (suitesRes.error) toast.error("Erro ao carregar suítes: " + suitesRes.error.message);
    if (casesRes.error) toast.error("Erro ao carregar casos: " + casesRes.error.message);

    const history: HistoryByCase = {};
    (runCasesRes.data ?? []).forEach((rc) => {
      if (!rc.executed_at) return;
      if (!history[rc.test_case_id]) history[rc.test_case_id] = [];
      history[rc.test_case_id].push(rc.status as RunCaseStatus);
    });

    setSuites((suitesRes.data as TestSuite[]) ?? []);
    setCases((casesRes.data as TestCase[]) ?? []);
    setHistoryByCase(history);
    setLoading(false);
    hasLoadedOnceRef.current = true;
  }, [activeProject]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function createSuite(title: string, parentSuiteId: string | null) {
    if (!activeProject) return;
    const { error } = await supabase
      .from("test_suites")
      .insert({ project_id: activeProject.id, title, parent_suite_id: parentSuiteId, position: suites.length });
    if (error) {
      toast.error("Erro ao criar suíte: " + error.message);
      return;
    }
    toast.success("Suíte criada.");
    await load();
  }

  async function renameSuite(id: string, title: string) {
    const { error } = await supabase.from("test_suites").update({ title }).eq("id", id);
    if (error) {
      toast.error("Erro ao renomear suíte: " + error.message);
      return;
    }
    await load();
  }

  async function moveSuite(id: string, parentSuiteId: string | null) {
    const { error } = await supabase.from("test_suites").update({ parent_suite_id: parentSuiteId }).eq("id", id);
    if (error) {
      toast.error("Erro ao mover suíte: " + error.message);
      return;
    }
    await load();
  }

  /**
   * Reordena uma suíte pra ficar antes ou depois de uma suíte-alvo, no
   * mesmo nível dela (mesma suíte-pai). Recalcula a posição de todos os
   * irmãos daquele nível pra garantir a ordem certa.
   */
  async function reorderSuite(draggedId: string, targetSuiteId: string, placement: "before" | "after") {
    const target = suites.find((s) => s.id === targetSuiteId);
    const dragged = suites.find((s) => s.id === draggedId);
    if (!target || !dragged || draggedId === targetSuiteId) return;

    const newParentId = target.parent_suite_id;
    const siblings = suites
      .filter((s) => s.id !== draggedId && (s.parent_suite_id ?? null) === (newParentId ?? null))
      .sort((a, b) => a.position - b.position);
    const targetIndex = siblings.findIndex((s) => s.id === targetSuiteId);
    const insertAt = placement === "before" ? targetIndex : targetIndex + 1;
    const newOrder = [...siblings.slice(0, insertAt), dragged, ...siblings.slice(insertAt)];

    const { error } = await Promise.all(
      newOrder.map((s, i) => supabase.from("test_suites").update({ position: i, parent_suite_id: newParentId }).eq("id", s.id))
    ).then((results) => results.find((r) => r.error) ?? { error: null });

    if (error) {
      toast.error("Erro ao reordenar suíte: " + error.message);
      return;
    }
    await load();
  }

  async function deleteSuite(id: string) {
    const { error } = await supabase.from("test_suites").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir suíte: " + error.message);
      return;
    }
    toast.success("Suíte excluída.");
    await load();
  }

  async function createCase(input: TestCaseInput & { description?: string }) {
    if (!activeProject) return null;
    const { data, error } = await supabase
      .from("test_cases")
      .insert({ ...input, project_id: activeProject.id, description: input.description ?? "" })
      .select()
      .single();
    if (error) {
      toast.error("Erro ao criar caso: " + error.message);
      return null;
    }
    toast.success("Caso de teste criado.");
    await load();
    return data as TestCase;
  }

  async function updateCase(id: string, input: Partial<TestCaseInput>) {
    const { error } = await supabase
      .from("test_cases")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error("Erro ao salvar caso: " + error.message);
      return false;
    }
    toast.success("Caso de teste salvo.");
    await load();
    return true;
  }

  async function duplicateCase(testCase: TestCase) {
    if (!activeProject) return;
    const { id, seq, created_at, updated_at, ...rest } = testCase;
    void id;
    void seq;
    void created_at;
    void updated_at;
    const { error } = await supabase.from("test_cases").insert({
      ...rest,
      title: `${testCase.title} (cópia)`,
      project_id: activeProject.id,
    });
    if (error) {
      toast.error("Erro ao duplicar caso: " + error.message);
      return;
    }
    toast.success("Caso duplicado.");
    await load();
  }

  async function deleteCase(id: string) {
    const { error } = await supabase.from("test_cases").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir caso: " + error.message);
      return;
    }
    toast.success("Caso de teste excluído.");
    await load();
  }

  async function bulkUpdateCases(ids: string[], patch: Partial<TestCaseInput>) {
    const { error } = await supabase.from("test_cases").update(patch).in("id", ids);
    if (error) {
      toast.error("Erro ao atualizar casos selecionados: " + error.message);
      return;
    }
    toast.success(`${ids.length} caso(s) atualizado(s).`);
    await load();
  }

  async function bulkCreateCases(
    inputs: (TestCaseInput & { description?: string })[],
    suiteId: string | null
  ) {
    if (!activeProject) return;
    const rows = inputs.map((input) => ({
      ...input,
      description: input.description ?? "",
      suite_id: suiteId,
      project_id: activeProject.id,
    }));
    const { error } = await supabase.from("test_cases").insert(rows);
    if (error) {
      toast.error("Erro ao importar casos: " + error.message);
      return;
    }
    toast.success(`${rows.length} caso(s) importado(s).`);
    await load();
  }

  async function bulkDeleteCases(ids: string[]) {
    const { error } = await supabase.from("test_cases").delete().in("id", ids);
    if (error) {
      toast.error("Erro ao excluir casos selecionados: " + error.message);
      return;
    }
    toast.success(`${ids.length} caso(s) excluído(s).`);
    await load();
  }

  return {
    loading,
    suites,
    cases,
    historyByCase,
    reload: load,
    createSuite,
    renameSuite,
    moveSuite,
    reorderSuite,
    deleteSuite,
    createCase,
    updateCase,
    duplicateCase,
    deleteCase,
    bulkUpdateCases,
    bulkCreateCases,
    bulkDeleteCases,
  };
}
