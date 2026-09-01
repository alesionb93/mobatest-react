import * as React from "react";
import { toast } from "sonner";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { RichEditor } from "@/components/ui/rich-editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useProject } from "@/contexts/project-context";
import { parseMaestroOutput } from "@/lib/maestro-log";
import type { TestRunCase } from "@/types/test-runs";

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

interface AddBugModalProps {
  open: boolean;
  onClose: () => void;
  runCase: TestRunCase;
  onDone: (extra: Record<string, unknown>) => Promise<void>;
  /** Preenchidos só quando o bug vem de uma falha do "Executar automatizado" */
  automatedLog?: string;
  automatedScreenshotBase64?: string | null;
}

function escapeHtml(s: string) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function buildAutomatedCard(log: string, hasScreenshot: boolean) {
  let parsed: ReturnType<typeof parseMaestroOutput>;
  try {
    parsed = parseMaestroOutput(log ?? "");
  } catch {
    parsed = { device: undefined, flow: undefined, steps: [], cleanedRaw: log ?? "" };
  }

  let problemHtml: string;
  if (parsed.steps.length === 0) {
    // Não reconheceu o formato — cai pro log cru mesmo, sem quebrar nada.
    const trimmed = log.trim();
    const kept = trimmed.length > 6000 ? trimmed.slice(-6000) : trimmed;
    problemHtml = kept ? `<pre>${escapeHtml(kept)}</pre>` : "<p><br></p>";
  } else {
    const meta =
      parsed.flow || parsed.device
        ? `<p><em>${[parsed.flow && `Fluxo: ${escapeHtml(parsed.flow)}`, parsed.device && `Dispositivo: ${escapeHtml(parsed.device)}`].filter(Boolean).join(" · ")}</em></p>`
        : "";
    const stepsHtml = parsed.steps
      .map((s) => {
        const icon = s.status === "passed" ? "✅" : "❌";
        const detail = s.detail ? `<br><span style="color:#b91c1c;">${escapeHtml(s.detail)}</span>` : "";
        return `<li>${icon} ${escapeHtml(s.label)}${detail}</li>`;
      })
      .join("");
    problemHtml =
      meta +
      `<ol>${stepsHtml}</ol>` +
      `<details><summary>Ver log técnico completo</summary><pre>${escapeHtml(
        parsed.cleanedRaw.length > 6000 ? parsed.cleanedRaw.slice(-6000) : parsed.cleanedRaw
      )}</pre></details>`;
  }

  return (
    "<p>🐞<strong>Problema:</strong></p>" +
    problemHtml +
    "<hr>" +
    "<p>👣<strong>Passos para reprodução:</strong></p><ol><li><br></li></ol><hr>" +
    "<p>✅<strong>Resultado esperado:</strong></p>" +
    "<p><strong>Dado que</strong></p><p><strong>Quando</strong></p><p><strong>Então</strong></p><hr>" +
    "<p>📸<strong>Evidência:</strong></p>" +
    (hasScreenshot ? "<p><em>Print automático da falha anexado nas evidências abaixo.</em></p>" : "")
  );
}

function AddBugModal({ open, onClose, runCase, onDone, automatedLog, automatedScreenshotBase64 }: AddBugModalProps) {
  const { user } = useAuth();
  const { activeProject } = useProject();
  const [source, setSource] = React.useState<"new" | "existing">("new");
  const [existingDefects, setExistingDefects] = React.useState<{ id: string; seq: number; title: string }[]>([]);
  const [reasons, setReasons] = React.useState<{ id: string; label: string }[]>([]);
  const [devs, setDevs] = React.useState<{ id: string; name: string }[]>([]);
  const [pos, setPos] = React.useState<{ id: string; name: string }[]>([]);

  const [title, setTitle] = React.useState("");
  const [card, setCard] = React.useState(() =>
    automatedLog ? buildAutomatedCard(automatedLog, !!automatedScreenshotBase64) : BUG_CARD_TEMPLATE
  );
  const [severity, setSeverity] = React.useState("normal");
  const [reasonId, setReasonId] = React.useState("");
  const [devId, setDevId] = React.useState("");
  const [poId, setPoId] = React.useState("");
  const [existingDefectId, setExistingDefectId] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open || !activeProject) return;
    setSource("new");
    setTitle(`Falha em: ${runCase.test_cases.title}`);
    setCard(automatedLog ? buildAutomatedCard(automatedLog, !!automatedScreenshotBase64) : BUG_CARD_TEMPLATE);
    setSeverity("normal");
    setReasonId("");
    setDevId("");
    setPoId("");
    setExistingDefectId("");

    Promise.all([
      supabase.from("defects").select("id, seq, title").eq("project_id", activeProject.id).order("created_at", { ascending: false }),
      supabase.from("failure_reasons").select("id, label").eq("is_active", true).order("label"),
      supabase.from("contacts").select("id, name").eq("kind", "dev").eq("is_active", true).order("name"),
      supabase.from("contacts").select("id, name").eq("kind", "po").eq("is_active", true).order("name"),
    ]).then(([defectsRes, reasonsRes, devsRes, posRes]) => {
      setExistingDefects(defectsRes.data ?? []);
      setReasons(reasonsRes.data ?? []);
      setDevs(devsRes.data ?? []);
      setPos(posRes.data ?? []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeProject]);

  async function uploadAutomatedScreenshot(defectId: string) {
    if (!automatedScreenshotBase64 || !activeProject) return;
    try {
      const byteChars = atob(automatedScreenshotBase64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: "image/png" });
      const storagePath = `${activeProject.id}/${defectId}/${Date.now()}-print-automatico.png`;
      const { error: upErr } = await supabase.storage.from("evidence").upload(storagePath, blob, { contentType: "image/png" });
      if (upErr) return;
      await supabase.from("attachments").insert({
        defect_id: defectId,
        storage_path: storagePath,
        file_name: "print-automatico.png",
        file_type: "image/png",
        file_size: blob.size,
        uploaded_by: user?.id,
      });
    } catch {
      // Upload do print é um "bônus" — se falhar, não trava a criação do defeito.
    }
  }

  async function handleSave() {
    if (source === "existing") {
      if (!existingDefectId) {
        toast.error("Selecione um defeito existente.");
        return;
      }
      const chosen = existingDefects.find((d) => d.id === existingDefectId);
      setSaving(true);
      if (chosen) await uploadAutomatedScreenshot(chosen.id);
      await onDone({
        comment: `Falha já mapeada no defeito ${activeProject?.code}-B${chosen?.seq} — ${chosen?.title}`,
      });
      setSaving(false);
      return;
    }

    if (!title.trim()) {
      toast.error("Dê um título ao bug.");
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
        test_case_id: runCase.test_case_id,
        test_run_case_id: runCase.id,
      })
      .select()
      .single();
    if (error) {
      setSaving(false);
      toast.error("Erro ao criar defeito: " + error.message);
      return;
    }
    if (data?.id) await uploadAutomatedScreenshot(data.id);
    setSaving(false);
    toast.success("Defeito criado!");
    await onDone({});
  }

  return (
    <Modal open={open} onClose={onClose} title="Adicionar defeito" size="lg" closeOnOutsideClick={false}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar e marcar como falhou"}
          </Button>
        </>
      }
    >
      <Tabs
        tabs={[
          { key: "new", label: "Criar novo bug" },
          { key: "existing", label: "Adicionar a bug existente" },
        ]}
        active={source}
        onChange={(k) => setSource(k as "new" | "existing")}
        className="mb-4"
      />

      {source === "new" ? (
        <div className="flex flex-col gap-4">
          <Input label="Título do bug" value={title} onChange={(e) => setTitle(e.target.value)} />
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
                    severity === s.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
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
      ) : (
        <Select
          label="Selecione o defeito já existente"
          value={existingDefectId}
          onChange={setExistingDefectId}
          options={[
            { value: "", label: "— Selecione —" },
            ...existingDefects.map((d) => ({ value: d.id, label: `${activeProject?.code}-B${d.seq} — ${d.title}` })),
          ]}
        />
      )}
    </Modal>
  );
}

export { AddBugModal };
