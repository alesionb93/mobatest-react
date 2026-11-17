import * as React from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { validateReview, type ReviewInput } from "@/lib/run-review";
import { useDevOptions } from "@/pages/test-runs/use-dev-options";
import type { TestRun } from "@/types/test-runs";

type Choice = "" | "approved" | "rejected" | "none";

const CHOICES: { value: Exclude<Choice, "">; label: string; hint: string }[] = [
  { value: "approved", label: "Aprovada", hint: "A tarefa passou no teste." },
  { value: "rejected", label: "Reprovada (devolvida ao dev)", hint: "Conta como 1 retorno para o dev responsável." },
  { value: "none", label: "Não se aplica", hint: "Regressão ou execução que não é de uma tarefa. Fica fora da métrica de retrabalho." },
];

interface RunReviewModalProps {
  open: boolean;
  onClose: () => void;
  /** "complete": é o Concluir. "edit": corrige a tarefa, o dev ou o resultado de uma rodada já avaliada. */
  mode: "complete" | "edit";
  run: TestRun;
  /** O dev que mais aparece nos defeitos da execução: sugestão quando a execução ainda não tem dev. */
  suggestedDevId: string | null;
  bugCount: number;
  onConfirm: (input: ReviewInput) => Promise<void>;
}

function RunReviewModal({ open, onClose, mode, run, suggestedDevId, bugCount, onConfirm }: RunReviewModalProps) {
  const [taskRef, setTaskRef] = React.useState("");
  const [devId, setDevId] = React.useState("");
  const [choice, setChoice] = React.useState<Choice>("");
  const devs = useDevOptions(open, run.dev_contact_id);
  const [saving, setSaving] = React.useState(false);

  // Só ao abrir: o que o QA digita não pode ser apagado se a página recarregar a execução por baixo.
  React.useEffect(() => {
    if (!open) return;
    setTaskRef(run.task_ref ?? "");
    setDevId(run.dev_contact_id ?? suggestedDevId ?? "");
    // Uma tarefa ou um dev já informados pedem uma escolha explícita; uma execução sem nenhum dos dois é "não se aplica".
    setChoice(run.review_outcome ?? (run.task_ref || run.dev_contact_id ? "" : "none"));
    setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const devName = devs.find((d) => d.id === devId)?.name;

  async function handleConfirm() {
    if (choice === "") {
      toast.error("Escolha o resultado da rodada.");
      return;
    }
    const input: ReviewInput = { outcome: choice === "none" ? null : choice, devId: devId || null, taskRef };
    const problem = validateReview(input);
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    await onConfirm(input);
    setSaving(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "complete" ? "Concluir execução" : "Tarefa e resultado da rodada"}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Voltar
          </Button>
          <Button onClick={handleConfirm} disabled={saving}>
            {mode === "complete" ? "Concluir execução" : "Salvar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          {mode === "complete"
            ? "Diga como esta rodada terminou. É isso que alimenta a métrica de retrabalho por dev."
            : "Corrija a tarefa, o dev ou o resultado desta rodada."}
        </p>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-foreground">Resultado da rodada *</legend>
          {CHOICES.map((c) => (
            <label
              key={c.value}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                choice === c.value ? "border-brand bg-brand/5" : "border-border"
              )}
            >
              <input type="radio" name="review-outcome" value={c.value} checked={choice === c.value} onChange={() => setChoice(c.value)} className="mt-0.5" />
              <span>
                <span className="font-medium text-foreground">{c.label}</span>
                <span className="block text-xs text-muted-foreground">{c.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <Input label="Tarefa" value={taskRef} onChange={(e) => setTaskRef(e.target.value)} placeholder="Ex: MOB-11270" />
          <p className="text-xs text-muted-foreground">
            O card do Jira ou qualquer texto. As execuções com a mesma tarefa são agrupadas pra contar as rodadas.
          </p>
        </div>

        <Select
          label={`Dev responsável${choice === "rejected" ? " *" : ""}`}
          value={devId}
          onChange={setDevId}
          options={[{ value: "", label: "— Selecione —" }, ...devs.map((d) => ({ value: d.id, label: d.inactive ? `${d.name} (inativo)` : d.name }))]}
        />
        {devs.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum dev cadastrado. Peça a um Admin pra cadastrar em &quot;Cadastros &gt; Contatos&quot;.</p>
        )}

        {choice === "rejected" && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Conta como <strong>1 retorno</strong>
            {devName ? (
              <>
                {" "}
                para <strong>{devName}</strong>
              </>
            ) : null}
            . {bugCount > 0 ? `Bugs registrados nesta execução: ${bugCount}.` : "Nenhum bug registrado nesta execução ainda."}
          </p>
        )}
      </div>
    </Modal>
  );
}

export { RunReviewModal };
