import * as React from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { RichEditor } from "@/components/ui/rich-editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useProject } from "@/contexts/project-context";

const BUG_CARD_TEMPLATE =
  "<p>🐞<strong>Problema:</strong></p><p><br></p><hr>" +
  "<p>👣<strong>Passos para reprodução:</strong></p><ol><li><br></li></ol><hr>" +
  "<p>✅<strong>Resultado esperado:</strong></p>" +
  "<p><strong>Dado que</strong></p><p><strong>Quando</strong></p><p><strong>Então</strong></p><hr>" +
  "<p>📸<strong>Evidência:</strong></p>";

const SEVERITY_DEFS = [
  { key: "minor", label: "Menor" },
  { key: "normal", label: "Normal" },
  { key: "major", label: "Maior" },
  { key: "critical", label: "Crítica" },
];

interface CreateDefectModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (defectId: string) => void;
}

function CreateDefectModal({ open, onClose, onCreated }: CreateDefectModalProps) {
  const { user } = useAuth();
  const { activeProject } = useProject();
  const [title, setTitle] = React.useState("");
  const [card, setCard] = React.useState(BUG_CARD_TEMPLATE);
  const [severity, setSeverity] = React.useState("normal");
  const [reasonId, setReasonId] = React.useState("");
  const [devId, setDevId] = React.useState("");
  const [poId, setPoId] = React.useState("");
  const [reasons, setReasons] = React.useState<{ id: string; label: string }[]>([]);
  const [devs, setDevs] = React.useState<{ id: string; name: string }[]>([]);
  const [pos, setPos] = React.useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTitle("");
    setCard(BUG_CARD_TEMPLATE);
    setSeverity("normal");
    setReasonId("");
    setDevId("");
    setPoId("");
    Promise.all([
      supabase.from("failure_reasons").select("id, label").eq("is_active", true).order("label"),
      supabase.from("contacts").select("id, name").eq("kind", "dev").eq("is_active", true).order("name"),
      supabase.from("contacts").select("id, name").eq("kind", "po").eq("is_active", true).order("name"),
    ]).then(([reasonsRes, devsRes, posRes]) => {
      setReasons(reasonsRes.data ?? []);
      setDevs(devsRes.data ?? []);
      setPos(posRes.data ?? []);
    });
  }, [open]);

  async function handleSave() {
    if (!title.trim()) {
      toast.error("Dê um título ao defeito.");
      return;
    }
    if (!reasonId) {
      toast.error("Selecione o motivo da falha.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("defects")
      .insert({
        title: title.trim(),
        description: card,
        severity,
        priority: "medium",
        failure_reason_id: reasonId,
        dev_contact_id: devId || null,
        po_contact_id: poId || null,
        project_id: activeProject?.id,
        reporter_id: user?.id,
      })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error("Erro ao reportar defeito: " + error.message);
      return;
    }
    toast.success("Defeito reportado!");
    onCreated(data.id);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reportar defeito"
      size="lg"
      closeOnOutsideClick={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Reportar defeito"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Botão de login não responde no Safari"
          autoFocus
        />
        <RichEditor label="Card" value={card} onChange={setCard} minHeight="180px" />
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Severidade</span>
          <div className="flex flex-wrap gap-2">
            {SEVERITY_DEFS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSeverity(s.key)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium",
                  severity === s.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <Select
          label="Motivo da falha *"
          value={reasonId}
          onChange={setReasonId}
          options={[{ value: "", label: "— Selecione —" }, ...reasons.map((r) => ({ value: r.id, label: r.label }))]}
        />
        {reasons.length === 0 && (
          <p className="text-xs text-muted-foreground -mt-2">
            Nenhum motivo cadastrado ainda — peça a um Admin pra cadastrar em "Cadastros".
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Dev responsável"
            value={devId}
            onChange={setDevId}
            options={[{ value: "", label: "— Sem responsável —" }, ...devs.map((d) => ({ value: d.id, label: d.name }))]}
          />
          <Select
            label="PO responsável"
            value={poId}
            onChange={setPoId}
            options={[{ value: "", label: "— Sem responsável —" }, ...pos.map((p) => ({ value: p.id, label: p.name }))]}
          />
        </div>
      </div>
    </Modal>
  );
}

export { CreateDefectModal };
