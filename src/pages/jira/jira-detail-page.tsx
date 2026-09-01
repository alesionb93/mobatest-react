import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { cn, richTextClasses } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { timeAgo, initials } from "@/lib/format";

interface Subtask {
  key: string;
  title: string;
  status?: string;
}

interface JiraDetail {
  id: string;
  jira_key: string;
  title: string;
  issue_type: string | null;
  priority: string | null;
  labels: string | null;
  jira_url: string | null;
  reporter_name: string | null;
  assignee_name: string | null;
  status_entered_at: string;
  description: string | null;
  description_html: string | null;
  subtasks: Subtask[] | null;
  claimed_by: string | null;
  claimed_at: string | null;
  created_test_case_id: string | null;
}

function JiraDetailPage({ itemId }: { itemId: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = React.useState<JiraDetail | null>(null);
  const [claimedByName, setClaimedByName] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("jira_queue_items").select("*").eq("id", itemId).single();
    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setItem(data as JiraDetail);
    if (data.claimed_by) {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", data.claimed_by).maybeSingle();
      setClaimedByName(profile?.full_name ?? null);
    } else {
      setClaimedByName(null);
    }
    setLoading(false);
  }, [itemId]);

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

  if (notFound || !item) {
    toast.error("Esse card não foi encontrado.");
    navigate("/jira", { replace: true });
    return null;
  }

  async function handleClaim() {
    const { error } = await supabase
      .from("jira_queue_items")
      .update({ claimed_by: user?.id, claimed_at: new Date().toISOString() })
      .eq("id", item!.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Card atribuído a você!");
    await load();
  }

  async function handleUnclaim() {
    const { error } = await supabase.from("jira_queue_items").update({ claimed_by: null, claimed_at: null }).eq("id", item!.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Card devolvido pra fila.");
    await load();
  }

  function handleCreateCase() {
    navigate("/test-cases", { state: { prefillTitle: item!.title, jiraQueueItemId: item!.id } });
  }

  function openSubtask(key: string) {
    if (!item?.jira_url) return;
    window.open(item.jira_url.replace(item.jira_key, key), "_blank");
  }

  const labels = (item.labels ?? "")
    .split(",")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-1 max-w-4xl">
      <Button variant="ghost" size="sm" className="self-start mb-2" onClick={() => navigate("/jira")}>
        <ArrowLeft size={14} /> Voltar para a fila
      </Button>

      <div className="flex items-center gap-3 flex-wrap mb-1">
        <span className="font-mono-table text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">
          {item.jira_key}
        </span>
        {item.jira_url && (
          <a
            href={item.jira_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand hover:underline inline-flex items-center gap-1"
          >
            Abrir no Jira <ExternalLink size={11} />
          </a>
        )}
      </div>

      <h1 className="text-2xl font-semibold text-foreground mb-2">{item.title}</h1>

      <div className="flex flex-wrap gap-2 mb-5">
        {item.issue_type && <Badge variant="info">{item.issue_type}</Badge>}
        {item.priority && <Badge variant="warning">{item.priority}</Badge>}
        {labels.map((l) => (
          <Badge key={l} variant="neutral">
            {l}
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Reporter</p>
          <p className="text-sm font-semibold text-foreground">{item.reporter_name ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Responsável no Jira</p>
          <p className="text-sm font-semibold text-foreground">{item.assignee_name ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Entrou em "Para teste"</p>
          <p className="text-sm font-semibold text-foreground">{new Date(item.status_entered_at).toLocaleString("pt-BR")}</p>
        </div>
      </div>

      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Descrição</p>
      <div className="rounded-xl border border-border bg-card p-4 mb-5">
        {item.description_html ? (
          <div
            className={cn("text-sm text-foreground", richTextClasses)}
            dangerouslySetInnerHTML={{ __html: item.description_html }}
          />
        ) : item.description ? (
          <p className="text-sm text-foreground whitespace-pre-wrap">{item.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Sem descrição.</p>
        )}
      </div>

      {item.subtasks && item.subtasks.length > 0 && (
        <>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Subtarefas</p>
          <div className="rounded-xl border border-border bg-card overflow-hidden mb-5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.subtasks.map((st) => (
                  <TableRow key={st.key} className="cursor-pointer" onClick={() => openSubtask(st.key)}>
                    <TableCell className="font-mono-table text-xs text-muted-foreground">{st.key}</TableCell>
                    <TableCell>{st.title}</TableCell>
                    <TableCell>
                      <Badge variant="success">{st.status ?? "—"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Quem está com este card</p>
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        {item.claimed_by ? (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
              {initials(claimedByName)}
            </div>
            <span className="text-sm font-semibold text-foreground">{claimedByName ?? "Alguém"}</span>
            <span className="text-xs text-muted-foreground">desde {timeAgo(item.claimed_at)}</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Ninguém pegou este card ainda.</p>
        )}
      </div>

      <div className="flex gap-2 mb-10">
        {!item.claimed_by && (
          <Button variant="secondary" onClick={handleClaim}>
            Pegar para mim
          </Button>
        )}
        {item.claimed_by === user?.id && (
          <Button variant="secondary" onClick={handleUnclaim}>
            Devolver pra fila
          </Button>
        )}
        {item.created_test_case_id ? (
          <Button onClick={() => navigate(`/test-cases/${item.created_test_case_id}`)}>Ver caso de teste criado →</Button>
        ) : (
          <Button onClick={handleCreateCase}>Criar caso de teste</Button>
        )}
      </div>
    </div>
  );
}

export { JiraDetailPage };
