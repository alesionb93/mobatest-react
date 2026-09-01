import * as React from "react";
import { Trash2, Plus, PlayCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { ProgressSegments } from "@/pages/test-runs/progress-segments";
import { useTestRunsList } from "@/pages/test-runs/use-test-runs-list";
import { NewRunModal } from "@/pages/test-runs/new-run-modal";
import { statusBadgeVariant, statusLabel } from "@/lib/labels";

function RunListPage() {
  const navigate = useNavigate();
  const { loading, runs, deleteRun } = useTestRunsList();
  const [newRunOpen, setNewRunOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Execuções</h1>
          <p className="text-sm text-muted-foreground">{runs.length} execução(ões)</p>
        </div>
        <Button onClick={() => setNewRunOpen(true)}>
          <Plus size={14} /> Nova execução
        </Button>
      </div>

      {runs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState icon={PlayCircle} message="Nenhuma execução ainda. Crie uma para começar a rodar seus casos de teste." />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {runs.map((r) => {
            const total = r.test_run_cases.length;
            const done = r.test_run_cases.filter((rc) => rc.status && rc.status !== "untested").length;
            const failed = r.test_run_cases.filter((rc) => rc.status === "failed").length;
            return (
              <Card
                key={r.id}
                className="cursor-pointer hover:border-ring transition-colors"
                onClick={() => navigate(`/test-runs/${r.id}`)}
              >
                <CardContent className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">{r.title}</span>
                        {r.is_public && <Badge variant="info">Pública</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.environment || "Sem ambiente definido"} · {new Date(r.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <Badge variant={statusBadgeVariant(r.status)}>{statusLabel(r.status)}</Badge>
                  </div>

                  <ProgressSegments statuses={r.test_run_cases.map((rc) => rc.status)} />

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {done}/{total} executados
                    </span>
                    <div className="flex items-center gap-3">
                      {failed > 0 ? (
                        <span className="text-red-600 font-medium">{failed} falha(s)</span>
                      ) : (
                        <span className="text-muted-foreground">0 falhas</span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(r.id);
                        }}
                        className="text-muted-foreground hover:text-destructive rounded p-1"
                        title="Excluir execução"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <NewRunModal open={newRunOpen} onClose={() => setNewRunOpen(false)} onCreated={(runId) => navigate(`/test-runs/${runId}`)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Excluir execução"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (deleteTarget) await deleteRun(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Excluir esta execução? Todos os resultados registrados nela serão perdidos. Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </div>
  );
}

export { RunListPage };
