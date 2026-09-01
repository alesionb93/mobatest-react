import * as React from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { TestRun } from "@/types/test-runs";

interface ShareReportModalProps {
  open: boolean;
  onClose: () => void;
  run: TestRun;
  onTogglePublic: (isPublic: boolean) => Promise<boolean>;
  onEnsureToken: () => Promise<string | null>;
}

function ShareReportModal({ open, onClose, run, onTogglePublic, onEnsureToken }: ShareReportModalProps) {
  const [isPublic, setIsPublic] = React.useState(run.is_public);
  const [token, setToken] = React.useState(run.report_token);

  React.useEffect(() => {
    if (open) {
      setIsPublic(run.is_public);
      setToken(run.report_token);
      if (!run.report_token) onEnsureToken().then((t) => t && setToken(t));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const publicUrl = `${window.location.origin}/report?token=${token}`;

  async function handleToggle(checked: boolean) {
    const ok = await onTogglePublic(checked);
    if (ok) {
      setIsPublic(checked);
      toast.success(checked ? "Link público ativado!" : "Link público desativado.");
    }
  }

  function copyLink() {
    navigator.clipboard?.writeText(publicUrl).catch(() => {});
    toast.success("Link copiado!");
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Compartilhar relatório"
      footer={<Button onClick={onClose}>Concluído</Button>}
    >
      <div className="flex flex-col gap-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <Switch checked={isPublic} onCheckedChange={handleToggle} aria-label="Ativar link público" />
          <span className="text-sm text-foreground">
            Ativar link público — qualquer pessoa com o link pode <strong>visualizar</strong> esta execução, sem
            fazer login e sem conseguir alterar nada. Desative quando quiser revogar o acesso.
          </span>
        </label>

        {isPublic && (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Link público desta execução</span>
            <div className="flex gap-2">
              <input
                readOnly
                value={publicUrl}
                onFocus={(e) => e.target.select()}
                className="flex-1 rounded-lg border border-input bg-muted px-3 py-2 text-sm"
              />
              <Button variant="secondary" size="sm" onClick={copyLink}>
                Copiar
              </Button>
            </div>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Sem o link ativado, apenas quem tem acesso ao Mobatest (login) consegue ver esta execução.
        </p>
      </div>
    </Modal>
  );
}

export { ShareReportModal };
