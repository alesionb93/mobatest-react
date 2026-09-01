import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Lock, SkipForward, History as HistoryIcon, Play, Loader2 } from "lucide-react";
import { cn, richTextClasses } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { statusBadgeVariant, statusLabel } from "@/lib/labels";
import { formatMMSS } from "@/pages/test-runs/run-helpers";
import { AddBugModal } from "@/pages/test-runs/add-bug-modal";
import { MaestroLogView } from "@/pages/test-runs/maestro-log-view";
import { startMaestroRun, resumeMaestroJob } from "@/lib/maestro-agent";
import type { TestRunCase, RunCaseResultStatus } from "@/types/test-runs";
import type { TestSuite } from "@/types/test-cases";

const STATUS_DEFS: { key: RunCaseResultStatus; label: string; icon: typeof CheckCircle2 }[] = [
  { key: "passed", label: "Passou", icon: CheckCircle2 },
  { key: "failed", label: "Falhou", icon: XCircle },
  { key: "blocked", label: "Bloqueado", icon: Lock },
  { key: "skipped", label: "Pulado", icon: SkipForward },
  { key: "pre_existing", label: "Pré-existente", icon: HistoryIcon },
];

const STATUS_COLORS: Record<RunCaseResultStatus, string> = {
  passed: "border-emerald-200 text-emerald-700 hover:bg-emerald-50 data-[active=true]:bg-emerald-500 data-[active=true]:text-white data-[active=true]:border-emerald-500",
  failed: "border-red-200 text-red-700 hover:bg-red-50 data-[active=true]:bg-red-500 data-[active=true]:text-white data-[active=true]:border-red-500",
  blocked: "border-amber-200 text-amber-700 hover:bg-amber-50 data-[active=true]:bg-amber-500 data-[active=true]:text-white data-[active=true]:border-amber-500",
  skipped: "border-slate-200 text-slate-600 hover:bg-slate-50 data-[active=true]:bg-slate-500 data-[active=true]:text-white data-[active=true]:border-slate-500",
  pre_existing: "border-violet-200 text-violet-700 hover:bg-violet-50 data-[active=true]:bg-violet-500 data-[active=true]:text-white data-[active=true]:border-violet-500",
  untested: "border-border text-muted-foreground",
};

function ReadonlyBlock({ html, emptyLabel }: { html: string | null | undefined; emptyLabel: string }) {
  const value = (html ?? "").trim();
  if (!value) return <p className="text-sm text-muted-foreground italic">{emptyLabel}</p>;
  return (
    <div
      className={cn("text-sm text-foreground", richTextClasses)}
      dangerouslySetInnerHTML={{ __html: value }}
    />
  );
}

interface RunCaseDrawerProps {
  open: boolean;
  onClose: () => void;
  runCaseId: string | null;
  orderedIds: string[];
  suites: TestSuite[];
  projectCode: string;
  onAdvance: (nextId: string | null) => void;
  onStatusApplied: () => Promise<void>;
}

function RunCaseDrawer({
  open,
  onClose,
  runCaseId,
  orderedIds,
  suites,
  projectCode,
  onAdvance,
  onStatusApplied,
}: RunCaseDrawerProps) {
  const { user } = useAuth();
  const [tab, setTab] = React.useState("execution");
  const [rc, setRc] = React.useState<TestRunCase | null>(null);
  const [history, setHistory] = React.useState<
    { status: RunCaseResultStatus; executed_at: string | null; test_runs: { title: string; environment: string | null } | null }[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [elapsed, setElapsed] = React.useState(0);
  const [addBugOpen, setAddBugOpen] = React.useState(false);
  const [bugModalKey, setBugModalKey] = React.useState(0);
  const [runningAutomated, setRunningAutomated] = React.useState(false);
  const [lastAutomatedRun, setLastAutomatedRun] = React.useState<{
    status: RunCaseResultStatus;
    output: string;
    screenshotBase64: string | null;
  } | null>(null);
  const [showLog, setShowLog] = React.useState(false);
  const openedAtRef = React.useRef(Date.now());

  React.useEffect(() => {
    if (!open || !runCaseId) return;
    setLoading(true);
    setTab("execution");
    openedAtRef.current = Date.now();
    setElapsed(0);

    supabase
      .from("test_run_cases")
      .select("*, test_cases(title, seq, priority, suite_id, automation_status, automation_script_path, description, preconditions, repro_steps, postconditions)")
      .eq("id", runCaseId)
      .single()
      .then(async ({ data }) => {
        setRc(data as TestRunCase);
        if (data) {
          const { data: hist } = await supabase
            .from("test_run_cases")
            .select("status, executed_at, test_runs(title, environment)")
            .eq("test_case_id", data.test_case_id)
            .order("executed_at", { ascending: false });
          setHistory(
            ((hist ?? []) as unknown as {
              status: RunCaseResultStatus;
              executed_at: string | null;
              test_runs: { title: string; environment: string | null } | { title: string; environment: string | null }[] | null;
            }[])
              .filter((h) => h.executed_at)
              .map((h) => ({
                ...h,
                test_runs: Array.isArray(h.test_runs) ? h.test_runs[0] : h.test_runs,
              }))
          );
        }
        setLoading(false);
      });
  }, [open, runCaseId]);

  React.useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - openedAtRef.current) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [open]);

  const tc = rc?.test_cases;
  const suiteName = suites.find((s) => s.id === tc?.suite_id)?.title;

  async function applyStatus(status: RunCaseResultStatus, extra: Record<string, unknown> = {}) {
    if (!rc || !user) return;
    const durationSeconds = Math.round((Date.now() - openedAtRef.current) / 1000);
    const { error } = await supabase
      .from("test_run_cases")
      .update({
        status,
        executed_at: new Date().toISOString(),
        executed_by: user.id,
        duration_seconds: durationSeconds,
        ...extra,
      })
      .eq("id", rc.id);
    if (error) return;

    await onStatusApplied();

    const currentIndex = orderedIds.indexOf(rc.id);
    const nextId = orderedIds[currentIndex + 1] ?? null;
    onAdvance(nextId);
  }

  function handleStatusClick(status: RunCaseResultStatus) {
    if (status === "failed") {
      setLastAutomatedRun(null);
      setBugModalKey((k) => k + 1);
      setAddBugOpen(true);
    } else {
      applyStatus(status);
    }
  }

  async function handleRunAutomated() {
    if (!tc?.automation_script_path) return;
    setRunningAutomated(true);
    setShowLog(false);
    try {
      const started = await startMaestroRun(tc.automation_script_path);
      if (!started.ok) {
        toast.error(`Erro ao executar: ${started.error}`);
        return;
      }

      const data = await resumeMaestroJob(started.jobId);
      if (!data.ok) {
        toast.error(data.error);
        return;
      }

      toast.success(`Teste automatizado ${data.status === "passed" ? "passou" : "falhou"} (${data.duration}s)!`);
      setLastAutomatedRun({
        status: data.status,
        output: data.output ?? "",
        screenshotBase64: data.screenshotBase64 ?? null,
      });

      if (data.status === "failed") {
        // Mesmo comportamento já existente ao clicar manualmente em "Falhou":
        // abre o formulário de criar defeito — já vem preenchido com o log.
        setBugModalKey((k) => k + 1);
        setAddBugOpen(true);
      } else {
        await applyStatus("passed", { duration_seconds: data.duration });
      }
    } catch {
      toast.error("Não consegui conectar ao executor local — ele está rodando? (veja maestro-agent/README.md)");
    } finally {
      setRunningAutomated(false);
    }
  }

  if (!open) return null;

  return (
    <Drawer
      key={runCaseId ?? "none"}
      open={open}
      onClose={onClose}
      width="lg"
      title={loading ? "Carregando..." : tc?.title ?? ""}
      subtitle={
        tc && (
          <span className="text-xs">
            {projectCode}-{tc.seq}
            {suiteName ? ` · ${suiteName}` : ""}
          </span>
        )
      }
    >
      {loading || !rc || !tc ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <Tabs
            tabs={[
              { key: "execution", label: "Execução" },
              { key: "history", label: "Histórico de execuções" },
            ]}
            active={tab}
            onChange={setTab}
            className="mb-4 -mt-1"
          />

          {tab === "execution" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Marcar resultado
                  </span>
                  <span className="font-mono-table text-xs text-muted-foreground">⏱ {formatMMSS(elapsed)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_DEFS.map((s) => (
                    <button
                      key={s.key}
                      data-active={rc.status === s.key}
                      onClick={() => handleStatusClick(s.key)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                        STATUS_COLORS[s.key]
                      )}
                    >
                      <s.icon size={15} />
                      {s.label}
                    </button>
                  ))}
                </div>

                {tc.automation_status === "automated" && tc.automation_script_path && (
                  <div className="flex flex-col gap-1 pt-1">
                    <button
                      onClick={handleRunAutomated}
                      disabled={runningAutomated}
                      className="flex items-center justify-center gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-sm font-medium text-brand hover:bg-brand/10 disabled:opacity-60 w-fit"
                    >
                      {runningAutomated ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                      {runningAutomated ? "Executando..." : "Executar automatizado"}
                    </button>
                    <span className="font-mono-table text-xs text-muted-foreground">
                      {tc.automation_script_path}
                    </span>

                    {lastAutomatedRun && (
                      <div className="mt-1">
                        <button
                          onClick={() => setShowLog((v) => !v)}
                          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                        >
                          {showLog ? "Ocultar" : "Ver"} log da última execução automatizada
                        </button>
                        {showLog && (
                          <div className="mt-2 flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
                            <div className="flex items-center gap-2">
                              <Badge variant={statusBadgeVariant(lastAutomatedRun.status)}>
                                {statusLabel(lastAutomatedRun.status)}
                              </Badge>
                            </div>
                            {lastAutomatedRun.screenshotBase64 && (
                              <img
                                src={`data:image/png;base64,${lastAutomatedRun.screenshotBase64}`}
                                alt="Print do momento da falha"
                                className="max-h-56 w-fit rounded-md border border-border cursor-zoom-in"
                                onClick={() => window.open(`data:image/png;base64,${lastAutomatedRun.screenshotBase64}`, "_blank")}
                              />
                            )}
                            <MaestroLogView output={lastAutomatedRun.output} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Descrição</span>
                <ReadonlyBlock html={tc.description} emptyLabel="Sem descrição." />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pré-requisitos</span>
                <ReadonlyBlock html={tc.preconditions} emptyLabel="Não definido." />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Passos para reprodução
                </span>
                <ReadonlyBlock html={tc.repro_steps} emptyLabel="Não definido." />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Resultado esperado
                </span>
                <ReadonlyBlock html={tc.postconditions} emptyLabel="Não definido." />
              </div>
            </div>
          )}

          {tab === "history" &&
            (history.length === 0 ? (
              <EmptyState message="Nenhuma execução anterior registrada para este caso." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Execução</TableHead>
                    <TableHead>Ambiente</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Quando</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{h.test_runs?.title ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{h.test_runs?.environment ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(h.status)}>{statusLabel(h.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {h.executed_at ? new Date(h.executed_at).toLocaleString("pt-BR") : "não executado"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}

          <AddBugModal
            key={bugModalKey}
            open={addBugOpen}
            onClose={() => setAddBugOpen(false)}
            runCase={rc}
            automatedLog={lastAutomatedRun?.status === "failed" ? lastAutomatedRun.output : undefined}
            automatedScreenshotBase64={lastAutomatedRun?.status === "failed" ? lastAutomatedRun.screenshotBase64 : undefined}
            onDone={async (extra) => {
              setAddBugOpen(false);
              await applyStatus("failed", extra);
            }}
          />
        </>
      )}
    </Drawer>
  );
}

export { RunCaseDrawer };
