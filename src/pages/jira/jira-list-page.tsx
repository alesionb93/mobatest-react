import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { KanbanSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useProject } from "@/contexts/project-context";
import { Button } from "@/components/ui/button";
import { Skeleton, EmptyState } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { timeAgo, initials } from "@/lib/format";

interface JiraItem {
  id: string;
  jira_key: string;
  title: string;
  issue_type: string | null;
  status_entered_at: string;
  claimed_by: string | null;
  created_test_case_id: string | null;
}

function JiraListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeProject } = useProject();
  const [items, setItems] = React.useState<JiraItem[]>([]);
  const [names, setNames] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    if (!activeProject) return;
    setLoading(true);
    const [itemsRes, profilesRes] = await Promise.all([
      supabase
        .from("jira_queue_items")
        .select("id, jira_key, title, issue_type, status_entered_at, claimed_by, created_test_case_id")
        .eq("project_id", activeProject.id)
        .order("status_entered_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
    ]);
    setItems((itemsRes.data as JiraItem[]) ?? []);
    const map: Record<string, string> = {};
    (profilesRes.data ?? []).forEach((p) => (map[p.id] = p.full_name ?? ""));
    setNames(map);
    setLoading(false);
  }, [activeProject]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleClaim(id: string) {
    const { error } = await supabase
      .from("jira_queue_items")
      .update({ claimed_by: user?.id, claimed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Card atribuído a você!");
    await load();
  }

  async function handleUnclaim(id: string) {
    const { error } = await supabase.from("jira_queue_items").update({ claimed_by: null, claimed_at: null }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Card devolvido pra fila.");
    await load();
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const pending = items.filter((i) => !i.created_test_case_id);
  const done = items.filter((i) => i.created_test_case_id);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900">
        🔌 Este módulo ainda não está conectado ao Jira de verdade — os itens abaixo entram aqui manualmente por
        enquanto. Quando o webhook do Jira estiver configurado, cards que mudarem para "Para teste" vão aparecer aqui
        sozinhos.
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {pending.length === 0 ? (
          <EmptyState icon={KanbanSquare} message='Nenhum card esperando teste. Cards do Jira que entrarem em "Para teste" vão aparecer aqui.' />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Entrou em</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((item) => (
                <TableRow key={item.id} className="cursor-pointer" onClick={() => navigate(`/jira/${item.id}`)}>
                  <TableCell className="font-mono-table text-xs text-muted-foreground">{item.jira_key}</TableCell>
                  <TableCell className="font-medium">{item.title}</TableCell>
                  <TableCell className="text-muted-foreground">{item.issue_type ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{timeAgo(item.status_entered_at)}</TableCell>
                  <TableCell>
                    {item.claimed_by ? (
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                          {initials(names[item.claimed_by])}
                        </div>
                        <span className="text-xs">{names[item.claimed_by] ?? "Alguém"}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Ninguém ainda</span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {!item.claimed_by && (
                      <Button size="sm" variant="secondary" onClick={() => handleClaim(item.id)}>
                        Pegar para mim
                      </Button>
                    )}
                    {item.claimed_by === user?.id && (
                      <Button size="sm" variant="secondary" onClick={() => handleUnclaim(item.id)}>
                        Devolver
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {done.length > 0 && (
        <>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Já viraram caso de teste ({done.length})
          </p>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Card</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Caso de teste</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {done.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer" onClick={() => navigate(`/jira/${item.id}`)}>
                    <TableCell className="font-mono-table text-xs text-muted-foreground">{item.jira_key}</TableCell>
                    <TableCell className="text-muted-foreground">{item.title}</TableCell>
                    <TableCell>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/test-cases/${item.created_test_case_id}`);
                        }}
                        className="text-brand hover:underline text-sm"
                      >
                        Ver caso →
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

export { JiraListPage };
