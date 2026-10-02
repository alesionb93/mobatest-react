import * as React from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

interface CancelRunModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reasonId: string) => Promise<void>;
}

function CancelRunModal({ open, onClose, onConfirm }: CancelRunModalProps) {
  const [reasons, setReasons] = React.useState<{ id: string; label: string }[]>([]);
  const [reasonId, setReasonId] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setReasonId("");
    supabase
      .from("cancellation_reasons")
      .select("id, label")
      .eq("is_active", true)
      .order("label")
      .then(({ data }) => setReasons(data ?? []));
  }, [open]);

  async function handleConfirm() {
    if (!reasonId) {
      toast.error("Selecione o motivo do cancelamento.");
      return;
    }
    setSaving(true);
    await onConfirm(reasonId);
    setSaving(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cancelar execução"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Voltar
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={saving}>
            Cancelar execução
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Os resultados já registrados continuam salvos, mas a execução sai da lista de execuções ativas.
        </p>
        <Select
          label="Motivo do cancelamento *"
          value={reasonId}
          onChange={setReasonId}
          options={[{ value: "", label: "— Selecione —" }, ...reasons.map((r) => ({ value: r.id, label: r.label }))]}
        />
        {reasons.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhum motivo cadastrado — peça a um Admin pra cadastrar em "Cadastros".
          </p>
        )}
      </div>
    </Modal>
  );
}

export { CancelRunModal };
