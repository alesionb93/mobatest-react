import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CaseSelectionTree } from "@/components/case-selection-tree";
import type { TestPlan, PlanCaseRef } from "@/types/test-plans";
import type { TestSuite } from "@/types/test-cases";

interface PlanModalProps {
  open: boolean;
  onClose: () => void;
  existing: TestPlan | null;
  suites: TestSuite[];
  cases: PlanCaseRef[];
  projectCode: string;
  onSave: (
    existing: TestPlan | null,
    input: { title: string; description: string; caseIds: string[] }
  ) => Promise<boolean | undefined>;
  onDelete: (id: string) => Promise<void>;
}

function PlanModal({ open, onClose, existing, suites, cases, projectCode, onSave, onDelete }: PlanModalProps) {
  const [title, setTitle] = React.useState(existing?.title ?? "");
  const [description, setDescription] = React.useState(existing?.description ?? "");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    () => new Set((existing?.test_plan_cases ?? []).map((tpc) => tpc.test_case_id))
  );
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    const ok = await onSave(existing, {
      title: title.trim(),
      description: description.trim(),
      caseIds: Array.from(selectedIds),
    });
    setSaving(false);
    if (ok !== false) onClose();
  }

  return (
    <Modal
      key={existing?.id ?? "new"}
      open={open}
      onClose={onClose}
      title={existing ? "Editar plano de teste" : "Novo plano de teste"}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          <div>
            {existing && (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !title.trim()}>
              {saving ? "Salvando..." : existing ? "Salvar alterações" : "Criar plano"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Ciclo de release 2.4"
          autoFocus
        />
        <Textarea
          label="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Objetivo deste plano"
          rows={2}
        />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Casos de teste incluídos</span>
            <span className="text-xs text-muted-foreground">{selectedIds.size} selecionado(s)</span>
          </div>
          <CaseSelectionTree
            suites={suites}
            cases={cases}
            projectCode={projectCode}
            selectedIds={selectedIds}
            onChange={setSelectedIds}
          />
        </div>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir plano de teste"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (existing) await onDelete(existing.id);
                setConfirmDelete(false);
                onClose();
              }}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Excluir este plano de teste? Essa ação não pode ser desfeita.</p>
      </Modal>
    </Modal>
  );
}

export { PlanModal };
