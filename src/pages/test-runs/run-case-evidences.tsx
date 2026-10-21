import * as React from "react";
import { toast } from "sonner";
import { ImagePlus, Film, Play, Paperclip, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/contexts/auth-context";
import { useProject } from "@/contexts/project-context";
import { formatBytes } from "@/lib/format";
import { compressEvidence, MediaCompressionError } from "@/lib/media-compress";
import { listEvidences, uploadEvidence, deleteEvidence, getEvidenceUrl } from "@/lib/run-case-evidences";
import type { RunCaseEvidence } from "@/types/test-runs";

interface Job {
  id: number;
  name: string;
  phase: "queued" | "compressing" | "uploading";
  /** 0 a 1; null quando a etapa não tem progresso medível (foto, upload). */
  progress: number | null;
}

const PHASE_LABEL: Record<Job["phase"], string> = {
  queued: "Na fila",
  compressing: "Comprimindo...",
  uploading: "Enviando...",
};

function EvidenceThumb({ evidence }: { evidence: RunCaseEvidence }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const isImage = evidence.file_type.startsWith("image/");
  const isVideo = evidence.file_type.startsWith("video/");

  React.useEffect(() => {
    let alive = true;
    getEvidenceUrl(evidence.storage_path, 3600).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [evidence.storage_path]);

  if (!url) return <div className="h-full w-full animate-pulse bg-muted" />;
  if (isImage) return <img src={url} alt={evidence.file_name} className="h-full w-full object-cover" />;
  if (isVideo) {
    return (
      <div className="relative h-full w-full bg-black">
        {/* #t=0.1 faz o navegador mostrar um quadro do vídeo como miniatura */}
        <video src={`${url}#t=0.1`} preload="metadata" muted className="h-full w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/60 p-2 text-white">
            <Play size={16} />
          </span>
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
      <Paperclip size={24} />
    </div>
  );
}

/** Nome de arquivo pra print colado: o navegador sempre chama de "image.png". */
function pastedFileName(file: File, index: number): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
  return `captura-${stamp}-${index + 1}.${ext}`;
}

interface RunCaseEvidencesProps {
  runCaseId: string;
}

/**
 * Evidências (foto/vídeo) do caso dentro da execução. Funciona em qualquer
 * status — antes ou depois de marcar o resultado — porque fica presa ao caso
 * da execução (test_run_case_id), não ao status. Foto e vídeo são comprimidos
 * no navegador antes de subir (ver lib/media-compress.ts).
 */
function RunCaseEvidences({ runCaseId }: RunCaseEvidencesProps) {
  const { user } = useAuth();
  const { activeProject } = useProject();
  const [items, setItems] = React.useState<RunCaseEvidence[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<RunCaseEvidence | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Um arquivo por vez: comprimir vídeo é pesado, e vários em paralelo estourariam a memória da aba.
  const queueRef = React.useRef<Promise<void>>(Promise.resolve());
  const jobIdRef = React.useRef(0);

  const refresh = React.useCallback(async () => {
    const { data, error } = await listEvidences(runCaseId);
    if (error) toast.error("Erro ao carregar evidências: " + error);
    else setItems(data);
  }, [runCaseId]);

  React.useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const run = React.useCallback(
    async (file: File, id: number) => {
      if (!activeProject || !user) return;
      const patch = (p: Partial<Job>) => setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...p } : j)));
      patch({ phase: "compressing", progress: file.type.startsWith("video/") ? 0 : null });
      try {
        const media = await compressEvidence(file, (ratio) => patch({ progress: ratio }));
        patch({ phase: "uploading", progress: null });
        const { error } = await uploadEvidence({
          projectId: activeProject.id,
          runCaseId,
          userId: user.id,
          media,
        });
        if (error) {
          toast.error(`Falha ao enviar "${file.name}": ${error}`);
          return;
        }
        toast.success(
          media.compressed
            ? `Evidência enviada (${formatBytes(media.originalSize)} → ${formatBytes(media.size)}).`
            : "Evidência enviada."
        );
        await refresh();
      } catch (err) {
        toast.error(err instanceof MediaCompressionError ? err.message : `Falha ao processar "${file.name}".`);
      } finally {
        setJobs((js) => js.filter((j) => j.id !== id));
      }
    },
    [activeProject, user, runCaseId, refresh]
  );

  const addFiles = React.useCallback(
    (files: File[]) => {
      for (const file of files) {
        const id = ++jobIdRef.current;
        setJobs((js) => [...js, { id, name: file.name, phase: "queued", progress: null }]);
        queueRef.current = queueRef.current.then(() => run(file, id));
      }
    },
    [run]
  );

  // Ctrl+V com um print na área de transferência (Win+Shift+S, por exemplo).
  React.useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.closest("input, textarea, select") || target.isContentEditable)) return;
      // Com um modal aberto por cima (ex: criar defeito), o Ctrl+V não é pra cá.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const files = Array.from(e.clipboardData?.files ?? []).filter(
        (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
      );
      if (files.length === 0) return;
      e.preventDefault();
      addFiles(files.map((f, i) => new File([f], pastedFileName(f, i), { type: f.type })));
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addFiles]);

  async function openEvidence(e: RunCaseEvidence) {
    const url = await getEvidenceUrl(e.storage_path, 300);
    if (!url) {
      toast.error("Não foi possível abrir o arquivo.");
      return;
    }
    window.open(url, "_blank");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { error } = await deleteEvidence(deleteTarget);
    setDeleteTarget(null);
    if (error) {
      toast.error("Erro ao remover evidência: " + error);
      return;
    }
    toast.success("Evidência removida.");
    await refresh();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    if (files.length === 0) {
      toast.error("Só foto ou vídeo.");
      return;
    }
    addFiles(files);
  }

  const compressing = jobs.some((j) => j.phase === "compressing" && j.progress !== null);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Evidências{items.length > 0 ? ` (${items.length})` : ""}
      </span>

      <div
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={handleDrop}
        className={cn(
          "rounded-xl border border-dashed p-3 transition-colors",
          dragging ? "border-brand bg-brand/5" : "border-border bg-card"
        )}
      >
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium cursor-pointer hover:bg-secondary w-fit">
            <ImagePlus size={14} />
            Adicionar foto ou vídeo
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-xs text-muted-foreground flex-1 min-w-[200px]">
            Também dá pra colar um print (Ctrl+V) ou arrastar o arquivo aqui. Foto e vídeo são comprimidos antes de
            enviar.
          </p>
        </div>

        {compressing && (
          <p className="mt-2 text-xs text-amber-600">Mantenha esta aba aberta enquanto o vídeo é comprimido.</p>
        )}

        {(jobs.length > 0 || loading || items.length > 0) && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {jobs.map((j) => (
              <div
                key={j.id}
                className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border p-2 text-center"
              >
                <Loader2 size={16} className="animate-spin text-muted-foreground" />
                <span className="w-full truncate text-xs text-muted-foreground" title={j.name}>
                  {j.name}
                </span>
                <span className="text-xs font-medium text-foreground">
                  {PHASE_LABEL[j.phase]}
                  {j.progress !== null ? ` ${Math.round(j.progress * 100)}%` : ""}
                </span>
                {j.progress !== null && (
                  <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-brand transition-all" style={{ width: `${Math.round(j.progress * 100)}%` }} />
                  </div>
                )}
              </div>
            ))}

            {loading && items.length === 0 && jobs.length === 0 && (
              <div className="aspect-square animate-pulse rounded-lg bg-muted" />
            )}

            {items.map((ev) => (
              <div key={ev.id} className="group relative">
                <button
                  onClick={() => openEvidence(ev)}
                  className="aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted"
                  title="Clique para abrir"
                >
                  <EvidenceThumb evidence={ev} />
                </button>
                <p className="mt-1 truncate text-xs text-muted-foreground" title={ev.file_name}>
                  {ev.file_type.startsWith("video/") && <Film size={11} className="mr-1 inline -mt-0.5" />}
                  {ev.file_name} · {formatBytes(ev.file_size)}
                </p>
                <button
                  onClick={() => setDeleteTarget(ev)}
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title="Excluir"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {!loading && items.length === 0 && jobs.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground italic">Nenhuma evidência anexada ainda.</p>
        )}
      </div>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Excluir evidência"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Excluir <span className="font-medium text-foreground">{deleteTarget?.file_name}</span>? Essa ação não pode
          ser desfeita.
        </p>
      </Modal>
    </div>
  );
}

export { RunCaseEvidences };
