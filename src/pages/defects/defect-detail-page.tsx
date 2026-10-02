import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { RichEditor } from "@/components/ui/rich-editor";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, richTextClasses } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/contexts/project-context";
import { statusBadgeVariant, statusLabel } from "@/lib/labels";
import { AttachmentsSection } from "@/pages/defects/attachments-section";
import { CommentsSection } from "@/pages/defects/comments-section";
import type { Defect, DefectStatus } from "@/types/defects";

const STATUS_OPTIONS: DefectStatus[] = ["open", "in_progress", "resolved", "closed"];
const SEVERITY_OPTIONS = ["minor", "normal", "major", "critical"];
const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"];

interface LookupItem {
  id: string;
  label: string;
}

function DefectDetailPage({ defectId }: { defectId: string }) {
  const navigate = useNavigate();
  const { activeProject } = useProject();
  const [defect, setDefect] = React.useState<Defect | null>(null);
  const [reasons, setReasons] = React.useState<LookupItem[]>([]);
  const [devs, setDevs] = React.useState<LookupItem[]>([]);
  const [pos, setPos] = React.useState<LookupItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Campos de edição
  const [title, setTitle] = React.useState("");
  const [card, setCard] = React.useState("");
  const [status, setStatus] = React.useState<string>("open");
  const [severity, setSeverity] = React.useState("normal");
  const [priority, setPriority] = React.useState("medium");
  const [reasonId, setReasonId] = React.useState("");
  const [devId, setDevId] = React.useState("");
  const [poId, setPoId] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    const [defectRes, reasonsRes, devsRes, posRes] = await Promise.all([
      supabase.from("defects").select("*, test_cases(title, seq)").eq("id", defectId).single(),
      supabase.from("failure_reasons").select("id, label").eq("is_active", true).order("label"),
      supabase.from("contacts").select("id, name").eq("kind", "dev").eq("is_active", true).order("name"),
      supabase.from("contacts").select("id, name").eq("kind", "po").eq("is_active", true).order("name"),
    ]);
    if (defectRes.error || !defectRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const d = defectRes.data as Defect;
    setDefect(d);
    setReasons((reasonsRes.data ?? []).map((r) => ({ id: r.id, label: r.label })));
    setDevs((devsRes.data ?? []).map((r) => ({ id: r.id, label: r.name })));
    setPos((posRes.data ?? []).map((r) => ({ id: r.id, label: r.name })));
    setTitle(d.title);
    setCard(d.description ?? "");
    setStatus(d.status);
    setSeverity(d.severity);
    setPriority(d.priority);
    setReasonId(d.failure_reason_id ?? "");
    setDevId(d.dev_contact_id ?? "");
    setPoId(d.po_contact_id ?? "");
    setLoading(false);
  }, [defectId]);

  React.useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound || !defect) {
    toast.error("Esse defeito não foi encontrado — pode ter sido excluído.");
    navigate("/defects", { replace: true });
    return null;
  }

  const reasonLabel = reasons.find((r) => r.id === defect.failure_reason_id)?.label;
  const devLabel = devs.find((d) => d.id === defect.dev_contact_id)?.label;
  const poLabel = pos.find((p) => p.id === defect.po_contact_id)?.label;

  function startEdit() {
    setTitle(defect!.title);
    setCard(defect!.description ?? "");
    setStatus(defect!.status);
    setSeverity(defect!.severity);
    setPriority(defect!.priority);
    setReasonId(defect!.failure_reason_id ?? "");
    setDevId(defect!.dev_contact_id ?? "");
    setPoId(defect!.po_contact_id ?? "");
    setIsEditing(true);
  }

  async function handleSave() {
    if (!defect) return;
    if (!title.trim()) {
      toast.error("Dê um título ao defeito.");
      return;
    }
    if (!reasonId) {
      toast.error("Selecione o motivo da falha.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("defects")
      .update({
        title: title.trim(),
        description: card,
        status,
        severity,
        priority,
        failure_reason_id: reasonId,
        dev_contact_id: devId || null,
        po_contact_id: poId || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", defect.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Defeito atualizado!");
    setIsEditing(false);
    await load();
  }

  async function handleDelete() {
    if (!defect) return;
    const { error } = await supabase.from("defects").delete().eq("id", defect.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Defeito excluído.");
    navigate("/defects", { replace: true });
  }

  return (
    <div className="flex flex-col gap-1 max-w-4xl">
      <Button variant="ghost" size="sm" className="self-start mb-2" onClick={() => navigate("/defects")}>
        <ArrowLeft size={14} /> Voltar para defeitos
      </Button>

      <div className="flex items-center gap-3 flex-wrap mb-1">
        <span className="font-mono-table text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">
          {activeProject?.code}-B{defect.seq}
        </span>
        {defect.test_cases && (
          <span className="text-xs text-muted-foreground">
            Relacionado ao caso{" "}
            <strong className="text-foreground">
              {activeProject?.code}-{defect.test_cases.seq}
            </strong>{" "}
            — {defect.test_cases.title}
          </span>
        )}
      </div>

      {isEditing ? (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título do defeito"
          className="text-2xl font-semibold text-foreground bg-transparent focus:outline-none focus:bg-muted/40 rounded-md px-1 -mx-1 mb-1"
        />
      ) : (
        <h1 className="text-2xl font-semibold text-foreground mb-1">{defect.title}</h1>
      )}
      <p className="text-xs text-muted-foreground mb-5">
        Criado em {new Date(defect.created_at).toLocaleString("pt-BR")}
        {defect.updated_at && defect.updated_at !== defect.created_at && (
          <> · Atualizado em {new Date(defect.updated_at).toLocaleString("pt-BR")}</>
        )}
      </p>

      {isEditing ? (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <Select
              label="Status"
              value={status}
              onChange={setStatus}
              options={STATUS_OPTIONS.map((s) => ({ value: s, label: statusLabel(s) }))}
            />
            <Select
              label="Severidade"
              value={severity}
              onChange={setSeverity}
              options={SEVERITY_OPTIONS.map((s) => ({ value: s, label: statusLabel(s) }))}
            />
            <Select
              label="Prioridade"
              value={priority}
              onChange={setPriority}
              options={PRIORITY_OPTIONS.map((s) => ({ value: s, label: statusLabel(s) }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <Select
              label="Motivo da falha *"
              value={reasonId}
              onChange={setReasonId}
              options={[{ value: "", label: "— Selecione —" }, ...reasons.map((r) => ({ value: r.id, label: r.label }))]}
            />
            <Select
              label="Dev responsável"
              value={devId}
              onChange={setDevId}
              options={[{ value: "", label: "— Sem responsável —" }, ...devs.map((r) => ({ value: r.id, label: r.label }))]}
            />
            <Select
              label="PO responsável"
              value={poId}
              onChange={setPoId}
              options={[{ value: "", label: "— Sem responsável —" }, ...pos.map((r) => ({ value: r.id, label: r.label }))]}
            />
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-5">
            <Badge variant={statusBadgeVariant(defect.status)}>{statusLabel(defect.status)}</Badge>
            <Badge variant={statusBadgeVariant(defect.severity)}>{statusLabel(defect.severity)}</Badge>
            <Badge variant={statusBadgeVariant(defect.priority)}>{statusLabel(defect.priority)}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Motivo da falha</p>
              <p className="text-sm font-semibold text-foreground">
                {reasonLabel ?? <span className="font-normal text-muted-foreground">Não definido</span>}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Dev responsável</p>
              <p className="text-sm font-semibold text-foreground">
                {devLabel ?? <span className="font-normal text-muted-foreground">Sem dev atribuído</span>}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">PO responsável</p>
              <p className="text-sm font-semibold text-foreground">
                {poLabel ?? <span className="font-normal text-muted-foreground">Sem PO atribuído</span>}
              </p>
            </div>
          </div>
        </>
      )}

      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Card</p>
      {isEditing ? (
        <RichEditor value={card} onChange={setCard} minHeight="220px" />
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 mb-5 min-h-[220px]">
          {card.trim() ? (
            <div className={cn("text-sm text-foreground", richTextClasses)} dangerouslySetInnerHTML={{ __html: card }} />
          ) : (
            <p className="text-sm text-muted-foreground">Sem descrição.</p>
          )}
        </div>
      )}

      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-6 mb-2">
        Evidências (fotos e vídeos)
      </p>
      <AttachmentsSection defectId={defect.id} />

      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-6 mb-2">Comentários</p>
      <CommentsSection defectId={defect.id} />

      <div className="flex gap-2 mt-6 mb-10">
        {isEditing ? (
          <>
            <Button variant="secondary" onClick={() => setIsEditing(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} /> Excluir
            </Button>
            <Button onClick={startEdit}>
              <Pencil size={14} /> Editar
            </Button>
          </>
        )}
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir defeito"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Excluir este defeito? Esta ação não pode ser desfeita.</p>
      </Modal>
    </div>
  );
}

export { DefectDetailPage };
