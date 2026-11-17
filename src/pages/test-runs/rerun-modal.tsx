import * as React from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { statusBadgeVariant, statusLabel } from "@/lib/labels";
import { cleanTaskRef } from "@/lib/run-review";
import { defaultRerunCaseIds, nextRoundNumber, nextRoundTitle, type RoundRun } from "@/lib/rerun";
import { useDevOptions } from "@/pages/test-runs/use-dev-options";
import type { TestRun, TestRunCase } from "@/types/test-runs";

interface RerunModalProps {
  open: boolean;
  onClose: () => void;
  /** A execução reprovada que será rodada de novo. */
  run: TestRun;
  runCases: TestRunCase[];
  projectCode: string;
  onCreated: (runId: string) => void;
}

function RerunModal({ open, onClose, run, runCases, projectCode, onCreated }: RerunModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = React.useState("");
  const [taskRef, setTaskRef] = React.useState("");
  const [devId, setDevId] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [ready, setReady] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const devs = useDevOptions(open, run.dev_contact_id);

  const ordered = React.useMemo(() => [...runCases].sort((a, b) => a.test_cases.seq - b.test_cases.seq), [runCases]);

  // Só ao abrir: o que o QA mexer não pode ser apagado se a página recarregar a execução por baixo.
  React.useEffect(() => {
    if (!open) return;
    setTaskRef(run.task_ref ?? "");
    setDevId(run.dev_contact_id ?? "");
    setSelected(new Set(defaultRerunCaseIds(runCases)));
    setSaving(false);
    setReady(false);
    setTitle(run.title);
    let alive = true;
    supabase
      .from("test_runs")
      .select("title, task_ref")
      .eq("project_id", run.project_id)
      .then(({ data }) => {
        if (!alive) return;
        setTitle(nextRoundTitle(run.title, nextRoundNumber(run, (data ?? []) as RoundRun[])));
        setReady(true);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!user) return;
    if (!title.trim()) {
      toast.error("Dê um título à execução.");
      return;
    }
    const chosen = ordered.filter((rc) => selected.has(rc.id));
    if (chosen.length === 0) {
      toast.error("Selecione ao menos um caso de teste.");
      return;
    }
    setSaving(true);
    const { data: created, error } = await supabase
      .from("test_runs")
      .insert({
        project_id: run.project_id,
        title: title.trim(),
        environment: run.environment,
        created_by: user.id,
        task_ref: cleanTaskRef(taskRef),
        dev_contact_id: devId || null,
      })
      .select()
      .single();
    if (error || !created) {
      setSaving(false);
      toast.error("Erro ao criar a nova rodada: " + (error?.message ?? "sem resposta"));
      return;
    }
    const rows = chosen.map((rc) => ({ test_run_id: created.id, test_case_id: rc.test_case_id, status: "untested" }));
    const { error: casesError } = await supabase.from("test_run_cases").insert(rows);
    if (casesError) {
      // Uma execução sem casos não serve pra nada: desfaz, em vez de deixar uma vazia na lista.
      await supabase.from("test_runs").delete().eq("id", created.id);
      setSaving(false);
      toast.error("Erro ao vincular os casos: " + casesError.message);
      return;
    }
    setSaving(false);
    toast.success("Nova rodada criada!");
    onCreated(created.id);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Executar novamente"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={saving || !ready}>
            {saving ? "Criando..." : "Criar nova rodada"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Cria uma nova execução da mesma tarefa, pra testar o que o dev corrigiu. A execução reprovada continua como está.
        </p>

        <Input label="Título da execução" value={title} onChange={(e) => setTitle(e.target.value)} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Tarefa" value={taskRef} onChange={(e) => setTaskRef(e.target.value)} placeholder="Ex: MOB-11270" />
          <Select
            label="Dev responsável"
            value={devId}
            onChange={setDevId}
            options={[{ value: "", label: "— Nenhum —" }, ...devs.map((d) => ({ value: d.id, label: d.inactive ? `${d.name} (inativo)` : d.name }))]}
          />
        </div>
        {!cleanTaskRef(taskRef) && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Sem Tarefa, esta rodada não é agrupada com a anterior nas métricas de retrabalho. Informe a Tarefa pra contar as rodadas.
          </p>
        )}
        <p className="text-xs text-muted-foreground">Ambiente: {run.environment || "Sem ambiente"} (o mesmo da execução anterior).</p>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              Casos a testar ({selected.size} de {ordered.length})
            </p>
            <div className="flex gap-3 text-xs">
              <button type="button" className="cursor-pointer text-brand hover:underline" onClick={() => setSelected(new Set(defaultRerunCaseIds(runCases)))}>
                Só os que não passaram
              </button>
              <button type="button" className="cursor-pointer text-brand hover:underline" onClick={() => setSelected(new Set(ordered.map((rc) => rc.id)))}>
                Todos
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Já vêm marcados os casos que falharam, ficaram bloqueados, foram pulados ou não foram testados. Marque também os que passaram pra rodar a tarefa inteira de novo.
          </p>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
            {ordered.map((rc) => (
              <label key={rc.id} className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-muted/40">
                <Checkbox checked={selected.has(rc.id)} onCheckedChange={() => toggle(rc.id)} aria-label={rc.test_cases.title} />
                <span className="font-mono-table text-xs text-muted-foreground">
                  {projectCode}-{rc.test_cases.seq}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{rc.test_cases.title}</span>
                <Badge variant={statusBadgeVariant(rc.status)}>{statusLabel(rc.status)}</Badge>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export { RerunModal };
