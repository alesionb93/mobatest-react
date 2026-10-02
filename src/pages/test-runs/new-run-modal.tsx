import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/contexts/project-context";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

interface CaseOption {
  id: string;
  title: string;
  seq: number;
}
interface PlanOption {
  id: string;
  title: string;
  caseIds: string[];
}

interface NewRunModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (runId: string) => void;
}

const ENV_OPTIONS = [
  { value: "Homologação", label: "Homologação" },
  { value: "Produção", label: "Produção" },
  { value: "Outro", label: "Outro" },
];

function NewRunModal({ open, onClose, onCreated }: NewRunModalProps) {
  const { activeProject } = useProject();
  const { user } = useAuth();
  const [loadingData, setLoadingData] = React.useState(true);
  const [cases, setCases] = React.useState<CaseOption[]>([]);
  const [plans, setPlans] = React.useState<PlanOption[]>([]);

  const [title, setTitle] = React.useState("");
  const [environment, setEnvironment] = React.useState("Homologação");
  const [source, setSource] = React.useState<"repository" | "plan">("repository");
  const [selectedCaseIds, setSelectedCaseIds] = React.useState<Set<string>>(new Set());
  const [selectedPlanId, setSelectedPlanId] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open || !activeProject) return;
    setLoadingData(true);
    setTitle("");
    setEnvironment("Homologação");
    setSource("repository");
    setSelectedCaseIds(new Set());
    setSelectedPlanId("");

    Promise.all([
      supabase
        .from("test_cases")
        .select("id, title, seq")
        .eq("project_id", activeProject.id)
        .eq("status", "active")
        .order("seq"),
      supabase
        .from("test_plans")
        .select("id, title")
        .eq("project_id", activeProject.id)
        .order("created_at", { ascending: false }),
      supabase.from("test_plan_cases").select("test_plan_id, test_case_id"),
    ]).then(([casesRes, plansRes, planCasesRes]) => {
      setCases((casesRes.data as CaseOption[]) ?? []);
      const planCasesAll = planCasesRes.data ?? [];
      setPlans(
        ((plansRes.data as { id: string; title: string }[]) ?? []).map((p) => ({
          ...p,
          caseIds: planCasesAll.filter((pc) => pc.test_plan_id === p.id).map((pc) => pc.test_case_id),
        }))
      );
      setLoadingData(false);
    });
  }, [open, activeProject]);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const casesById = React.useMemo(() => {
    const map: Record<string, CaseOption> = {};
    cases.forEach((c) => (map[c.id] = c));
    return map;
  }, [cases]);

  function toggleCase(id: string) {
    setSelectedCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    if (!activeProject || !user) return;
    if (!title.trim()) {
      toast.error("Dê um título à execução.");
      return;
    }
    let caseIds: string[];
    if (source === "plan") {
      if (!selectedPlan) {
        toast.error("Selecione um plano de teste.");
        return;
      }
      caseIds = selectedPlan.caseIds.filter((id) => casesById[id]);
    } else {
      caseIds = Array.from(selectedCaseIds);
    }
    if (caseIds.length === 0) {
      toast.error("Selecione ao menos um caso de teste.");
      return;
    }

    setSaving(true);
    const { data: run, error } = await supabase
      .from("test_runs")
      .insert({ project_id: activeProject.id, title: title.trim(), environment, created_by: user.id })
      .select()
      .single();
    if (error) {
      setSaving(false);
      toast.error("Erro ao criar execução: " + error.message);
      return;
    }

    const rows = caseIds.map((tcId) => ({ test_run_id: run.id, test_case_id: tcId, status: "untested" }));
    const { error: rcError } = await supabase.from("test_run_cases").insert(rows);
    setSaving(false);
    if (rcError) {
      toast.error("Erro ao vincular casos: " + rcError.message);
      return;
    }
    toast.success("Execução criada!");
    onCreated(run.id);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova execução de teste"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loadingData}>
            {saving ? "Criando..." : "Criar execução"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Título da execução"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Regressão Release 2.4"
          autoFocus
        />
        <div className="flex flex-col gap-1.5">
          <Select label="Ambiente" value={environment} onChange={setEnvironment} options={ENV_OPTIONS} />
          <p className="text-xs text-muted-foreground">
            Usado na métrica de defeitos escapados para produção — escolha "Produção" quando essa execução for de
            fato num ambiente produtivo.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Origem dos casos de teste</span>
          <Tabs
            tabs={[
              { key: "repository", label: "Do repositório" },
              { key: "plan", label: "De um plano de teste" },
            ]}
            active={source}
            onChange={(k) => setSource(k as "repository" | "plan")}
          />
        </div>

        {loadingData ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : source === "repository" ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{cases.length} caso(s) disponíveis</span>
              <button
                onClick={() => setSelectedCaseIds(new Set(cases.map((c) => c.id)))}
                className="text-xs text-brand hover:underline"
              >
                selecionar todos
              </button>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border p-2">
              {cases.length === 0 ? (
                <p className="text-sm text-muted-foreground p-2">Nenhum caso de teste ativo. Crie casos primeiro.</p>
              ) : (
                cases.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 py-1.5 px-1 cursor-pointer hover:bg-accent/40 rounded-md"
                  >
                    <Checkbox checked={selectedCaseIds.has(c.id)} onCheckedChange={() => toggleCase(c.id)} aria-label={c.title} />
                    <span className="font-mono-table text-xs text-muted-foreground shrink-0">
                      {activeProject?.code}-{c.seq}
                    </span>
                    <span className="text-sm truncate">{c.title}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Select
              label="Selecione o plano de teste"
              value={selectedPlanId}
              onChange={setSelectedPlanId}
              options={[
                { value: "", label: "— Selecione um plano —" },
                ...plans.map((p) => ({
                  value: p.id,
                  label: `${p.title} (${p.caseIds.length} caso${p.caseIds.length === 1 ? "" : "s"})`,
                })),
              ]}
            />
            {plans.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum plano de teste criado ainda. Crie um em "Planos de teste".
              </p>
            )}
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border p-2">
              {!selectedPlan ? (
                <p className="text-sm text-muted-foreground p-2">Selecione um plano acima para ver os casos incluídos.</p>
              ) : (
                selectedPlan.caseIds
                  .filter((id) => casesById[id])
                  .map((id) => (
                    <div key={id} className="flex items-center gap-2 py-1.5 px-1">
                      <span className="font-mono-table text-xs text-muted-foreground shrink-0">
                        {activeProject?.code}-{casesById[id].seq}
                      </span>
                      <span className="text-sm">{casesById[id].title}</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export { NewRunModal };
