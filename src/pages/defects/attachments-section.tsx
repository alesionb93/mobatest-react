import * as React from "react";
import { Upload, FileText, Film, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useProject } from "@/contexts/project-context";
import { formatBytes } from "@/lib/format";
import type { Attachment } from "@/types/defects";

const MAX_ATTACHMENT_SIZE = 150 * 1024 * 1024; // 150MB

function fileIcon(fileType: string) {
  if (fileType.startsWith("video/")) return Film;
  if (fileType === "application/pdf") return FileText;
  return Paperclip;
}

function AttachmentThumb({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const isImage = attachment.file_type.startsWith("image/");

  React.useEffect(() => {
    if (!isImage) return;
    supabase.storage
      .from("evidence")
      .createSignedUrl(attachment.storage_path, 3600)
      .then(({ data }) => data && setUrl(data.signedUrl));
  }, [attachment, isImage]);

  if (isImage) {
    return url ? (
      <img src={url} alt={attachment.file_name} className="h-full w-full object-cover" />
    ) : (
      <div className="h-full w-full animate-pulse bg-muted" />
    );
  }
  const Icon = fileIcon(attachment.file_type);
  return (
    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
      <Icon size={28} />
    </div>
  );
}

interface AttachmentsSectionProps {
  defectId: string;
}

function AttachmentsSection({ defectId }: AttachmentsSectionProps) {
  const { user } = useAuth();
  const { activeProject } = useProject();
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("attachments").select("*").eq("defect_id", defectId).order("created_at");
    if (error) {
      toast.error("Erro ao carregar evidências: " + error.message);
    } else {
      setAttachments((data as Attachment[]) ?? []);
    }
    setLoading(false);
  }, [defectId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !activeProject || !user) return;
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_SIZE) {
        toast.error(`"${file.name}" passa de 150MB e não foi enviado.`);
        continue;
      }
      setUploading((n) => n + 1);
      const path = `${activeProject.id}/${defectId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("evidence").upload(path, file);
      if (upErr) {
        toast.error(`Falha ao enviar "${file.name}": ${upErr.message}`);
        setUploading((n) => n - 1);
        continue;
      }
      const { error: insErr } = await supabase.from("attachments").insert({
        defect_id: defectId,
        storage_path: path,
        file_name: file.name,
        file_type: file.type || "application/octet-stream",
        file_size: file.size,
        uploaded_by: user.id,
      });
      setUploading((n) => n - 1);
      if (insErr) toast.error(insErr.message);
    }
    await load();
  }

  async function openAttachment(a: Attachment) {
    const { data, error } = await supabase.storage.from("evidence").createSignedUrl(a.storage_path, 300);
    if (error || !data) {
      toast.error("Não foi possível abrir o arquivo.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function deleteAttachment(a: Attachment) {
    await supabase.storage.from("evidence").remove([a.storage_path]);
    const { error } = await supabase.from("attachments").delete().eq("id", a.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Evidência removida.");
    await load();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <label className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2 text-sm font-medium cursor-pointer hover:bg-secondary w-fit">
        <Upload size={14} />
        Adicionar foto ou vídeo
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,application/pdf,.txt,.csv"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <p className="text-xs text-muted-foreground mt-1.5">Até 150MB por arquivo.</p>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {uploading > 0 &&
          Array.from({ length: uploading }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg border border-dashed border-border flex items-center justify-center animate-pulse text-xs text-muted-foreground">
              Enviando...
            </div>
          ))}
        {!loading && attachments.length === 0 && uploading === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">Nenhum arquivo anexado ainda.</p>
        )}
        {attachments.map((a) => (
          <div key={a.id} className="group relative">
            <button
              onClick={() => openAttachment(a)}
              className="aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted"
              title="Clique para abrir"
            >
              <AttachmentThumb attachment={a} />
            </button>
            <p className="mt-1 truncate text-xs text-muted-foreground" title={a.file_name}>
              {a.file_name} · {formatBytes(a.file_size)}
            </p>
            <button
              onClick={() => deleteAttachment(a)}
              className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100"
              title="Excluir"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export { AttachmentsSection };
