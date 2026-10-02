import * as React from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { timeAgo, initials } from "@/lib/format";
import type { DefectComment } from "@/types/defects";

interface CommentsSectionProps {
  defectId: string;
}

function CommentsSection({ defectId }: CommentsSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = React.useState<DefectComment[]>([]);
  const [names, setNames] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const [{ data: commentsData, error }, { data: profiles }] = await Promise.all([
      supabase.from("defect_comments").select("*").eq("defect_id", defectId).order("created_at"),
      supabase.from("profiles").select("id, full_name"),
    ]);
    if (error) {
      toast.error("Erro ao carregar comentários: " + error.message);
    } else {
      setComments((commentsData as DefectComment[]) ?? []);
    }
    const map: Record<string, string> = {};
    (profiles ?? []).forEach((p) => (map[p.id] = p.full_name ?? "Usuário"));
    setNames(map);
    setLoading(false);
  }, [defectId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed || !user) return;
    setSending(true);
    const { error } = await supabase.from("defect_comments").insert({ defect_id: defectId, user_id: user.id, body: trimmed });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setBody("");
    await load();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("defect_comments").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-3 mb-4">
        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!loading && comments.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum comentário ainda — seja o primeiro.</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
              {initials(names[c.user_id ?? ""])}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <strong className="text-xs text-foreground">{names[c.user_id ?? ""] ?? "Usuário"}</strong>
                <span className="text-[11px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                {c.user_id === user?.id && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="ml-auto text-muted-foreground hover:text-destructive rounded p-0.5"
                    title="Excluir"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-sm text-foreground whitespace-pre-wrap">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escreva um comentário..."
          rows={2}
          className="flex-1"
        />
        <Button onClick={handleSend} disabled={sending || !body.trim()}>
          Comentar
        </Button>
      </div>
    </div>
  );
}

export { CommentsSection };
