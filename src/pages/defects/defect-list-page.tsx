import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Bug, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { useProject } from "@/contexts/project-context";
import { useDefectsList } from "@/pages/defects/use-defects-list";
import { CreateDefectModal } from "@/pages/defects/create-defect-modal";
import { statusBadgeVariant, statusLabel } from "@/lib/labels";
import type { DefectStatus } from "@/types/defects";

const FILTERS: { key: DefectStatus | "all"; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "open", label: "Abertos" },
  { key: "in_progress", label: "Em andamento" },
  { key: "resolved", label: "Resolvidos" },
  { key: "closed", label: "Fechados" },
];

function DefectListPage() {
  const navigate = useNavigate();
  const { activeProject } = useProject();
  const { loading, defects } = useDefectsList();
  const [filter, setFilter] = React.useState<DefectStatus | "all">("all");
  const [createOpen, setCreateOpen] = React.useState(false);

  const filtered = filter === "all" ? defects : defects.filter((d) => d.status === filter);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f.key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label} ({f.key === "all" ? defects.length : defects.filter((d) => d.status === f.key).length})
            </button>
          ))}
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Reportar defeito
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Bug}
            message="Nenhum defeito encontrado. Ótimo sinal — ou ainda não há bugs reportados neste filtro."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Caso vinculado</TableHead>
                <TableHead>Criado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => (
                <TableRow key={d.id} className="cursor-pointer" onClick={() => navigate(`/defects/${d.id}`)}>
                  <TableCell className="font-mono-table text-xs text-muted-foreground">
                    {activeProject?.code}-B{d.seq}
                  </TableCell>
                  <TableCell className="font-medium">{d.title}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(d.severity)}>{statusLabel(d.severity)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(d.priority)}>{statusLabel(d.priority)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(d.status)}>{statusLabel(d.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {d.test_cases ? `${activeProject?.code}-${d.test_cases.seq}` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(d.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CreateDefectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => navigate(`/defects/${id}`)}
      />
    </div>
  );
}

export { DefectListPage };
