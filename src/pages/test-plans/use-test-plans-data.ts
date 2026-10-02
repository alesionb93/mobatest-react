import * as React from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useProject } from "@/contexts/project-context";
import type { TestPlan, PlanCaseRef } from "@/types/test-plans";
import type { TestSuite } from "@/types/test-cases";

export function useTestPlansData() {
  const { activeProject } = useProject();
  const { user } = useAuth();
  const [plans, setPlans] = React.useState<TestPlan[]>([]);
  const [cases, setCases] = React.useState<PlanCaseRef[]>([]);
  const [suites, setSuites] = React.useState<TestSuite[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!activeProject) {
      setPlans([]);
      setCases([]);
      setSuites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [plansRes, casesRes, suitesRes] = await Promise.all([
      supabase
        .from("test_plans")
        .select("*, test_plan_cases(test_case_id)")
        .eq("project_id", activeProject.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("test_cases")
        .select("id, title, seq, suite_id")
        .eq("project_id", activeProject.id)
        .order("seq"),
      supabase
        .from("test_suites")
        .select("*")
        .eq("project_id", activeProject.id)
        .order("position"),
    ]);
    if (plansRes.error) toast.error("Erro ao carregar planos: " + plansRes.error.message);
    setPlans((plansRes.data as TestPlan[]) ?? []);
    setCases((casesRes.data as PlanCaseRef[]) ?? []);
    setSuites((suitesRes.data as TestSuite[]) ?? []);
    setLoading(false);
  }, [activeProject]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function savePlan(
    existing: TestPlan | null,
    input: { title: string; description: string; caseIds: string[] }
  ) {
    if (!activeProject) return;
    let planId = existing?.id;

    if (existing) {
      const { error } = await supabase
        .from("test_plans")
        .update({ title: input.title, description: input.description })
        .eq("id", existing.id);
      if (error) {
        toast.error("Erro ao salvar plano: " + error.message);
        return false;
      }
      await supabase.from("test_plan_cases").delete().eq("test_plan_id", planId);
    } else {
      const { data, error } = await supabase
        .from("test_plans")
        .insert({
          project_id: activeProject.id,
          title: input.title,
          description: input.description,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) {
        toast.error("Erro ao criar plano: " + error.message);
        return false;
      }
      planId = data.id;
    }

    if (input.caseIds.length > 0 && planId) {
      const rows = input.caseIds.map((testCaseId) => ({ test_plan_id: planId, test_case_id: testCaseId }));
      const { error } = await supabase.from("test_plan_cases").insert(rows);
      if (error) {
        toast.error("Erro ao vincular casos ao plano: " + error.message);
        return false;
      }
    }

    toast.success(existing ? "Plano atualizado." : "Plano criado.");
    await load();
    return true;
  }

  async function deletePlan(id: string) {
    const { error } = await supabase.from("test_plans").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir plano: " + error.message);
      return;
    }
    toast.success("Plano excluído.");
    await load();
  }

  return { loading, plans, cases, suites, reload: load, savePlan, deletePlan };
}
