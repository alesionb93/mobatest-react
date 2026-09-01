import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { useProject } from "@/contexts/project-context";
import { useRunDetail } from "@/pages/test-runs/use-run-detail";
import { groupRunCasesBySuite, flattenGroups } from "@/pages/test-runs/run-helpers";
import { CasesTab } from "@/pages/test-runs/cases-tab";
import { DefectsTab, TeamTab } from "@/pages/test-runs/defects-and-team-tabs";
import { RunDetailSidebar } from "@/pages/test-runs/run-detail-sidebar";
import { RunCaseDrawer } from "@/pages/test-runs/run-case-drawer";
import { BulkRunModal } from "@/pages/test-runs/bulk-run-modal";
import type { TestRunCase } from "@/types/test-runs";
import { ShareReportModal } from "@/pages/test-runs/share-report-modal";
import { ExportRunModal } from "@/pages/test-runs/export-run-modal";
import { CancelRunModal } from "@/pages/test-runs/cancel-run-modal";
import { exportRunAsCSV, exportRunAsPDF } from "@/pages/test-runs/export-run";
import { statusBadgeVariant, statusLabel } from "@/lib/labels";

function RunDetailPage({ runId }: { runId: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeProject } = useProject();
  const {
    loading,
    notFound,
    run,
    runCases,
    suites,
    defects,
    profiles,
    reload,
    completeRun,
    cancelRun,
    togglePublic,
    ensureReportToken,
    bulkAssign,
    bulkRemove,
    updateReportNotes,
  } = useRunDetail(runId);

  const [tab, setTab] = React.useState("cases");
  const [openRunCaseId, setOpenRunCaseId] = React.useState<string | null>(null);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [exportOpen, setExportOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [bulkRunCases, setBulkRunCases] = React.useState<TestRunCase[] | null>(null);

  const groups = React.useMemo(() => groupRunCasesBySuite(runCases, suites), [runCases, suites]);
  const orderedIds = React.useMemo(() => flattenGroups(groups).map((rc) => rc.id), [groups]);

  const defectsWithCaseTitle = React.useMemo(
    () =>
      defects.map((d) => ({
        ...d,
        caseTitle: runCases.find((rc) => rc.id === d.test_run_case_id)?.test_cases.title,
      })),
    [defects, runCases]
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound || !run) {
    toast.error("Essa execução não foi encontrada — pode ter sido excluída.");
    navigate("/test-runs", { replace: true });
    return null;
  }

  const TABS = [
    { key: "cases", label: "Casos de teste" },
    { key: "defects", label: `Defeitos${defects.length ? ` (${defects.length})` : ""}` },
    { key: "team", label: "Estatísticas da equipe" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start" onClick={() => navigate("/test-runs")}>
        <ArrowLeft size={14} /> Voltar para execuções
      </Button>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-foreground">{run.title}</h1>
          <Badge variant={statusBadgeVariant(run.status)}>{statusLabel(run.status)}</Badge>
          {run.is_public && <Badge variant="info">Link público ativo</Badge>}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {run.environment || "Sem ambiente"} · Criada em {new Date(run.created_at).toLocaleString("pt-BR")}
        </p>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0">
          {tab === "cases" &&
            (groups.length === 0 ? (
              <div className="rounded-xl border border-border bg-card">
                <EmptyState message="Nenhum caso nesta execução." />
              </div>
            ) : (
              <CasesTab
                groups={groups}
                projectCode={activeProject?.code ?? ""}
                profiles={profiles}
                currentUserId={user?.id}
                onOpenCase={setOpenRunCaseId}
                onRunAutomatedSelected={setBulkRunCases}
                onAssignSelected={(ids) => bulkAssign(ids, user?.id ?? null)}
                onUnassignSelected={(ids) => bulkAssign(ids, null)}
                onRemoveSelected={(ids) => {
                  if (confirm(`Remover ${ids.length} caso(s) desta execução? Isso não exclui o caso de teste, só tira ele desta execução.`)) {
                    bulkRemove(ids);
                  }
                }}
              />
            ))}
          {tab === "defects" && <DefectsTab defects={defectsWithCaseTitle} projectCode={activeProject?.code ?? ""} />}
          {tab === "team" && <TeamTab runCases={runCases} profiles={profiles} currentUserId={user?.id} />}
        </div>

        <RunDetailSidebar
          run={run}
          runCases={runCases}
          profiles={profiles}
          onShare={() => setShareOpen(true)}
          onExport={() => setExportOpen(true)}
          onCancel={() => setCancelOpen(true)}
          onComplete={() => {
            if (confirm("Marcar esta execução como concluída?")) completeRun();
          }}
        />
      </div>

      <RunCaseDrawer
        open={openRunCaseId !== null}
        onClose={() => setOpenRunCaseId(null)}
        runCaseId={openRunCaseId}
        orderedIds={orderedIds}
        suites={suites}
        projectCode={activeProject?.code ?? ""}
        onAdvance={(nextId) => {
          if (nextId) {
            setOpenRunCaseId(nextId);
          } else {
            setOpenRunCaseId(null);
            toast.success("Você chegou ao último caso desta execução!");
          }
        }}
        onStatusApplied={async () => {
          toast.success("Status atualizado!");
          await reload();
        }}
      />

      {bulkRunCases && (
        <BulkRunModal
          open={bulkRunCases !== null}
          onClose={() => setBulkRunCases(null)}
          cases={bulkRunCases}
          onFinished={reload}
        />
      )}

      <ShareReportModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        run={run}
        onTogglePublic={togglePublic}
        onEnsureToken={ensureReportToken}
      />

      <ExportRunModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        initialNotes={run.report_notes}
        onExport={async (format, notes) => {
          await updateReportNotes(notes);
          if (format === "csv") exportRunAsCSV(run, groups, notes, profiles, activeProject?.code ?? "PROJ");
          else exportRunAsPDF(run, groups, notes, profiles, activeProject?.code ?? "PROJ");
        }}
      />

      <CancelRunModal open={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={cancelRun} />
    </div>
  );
}

export { RunDetailPage };
