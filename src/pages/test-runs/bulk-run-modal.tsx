import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useProject } from "@/contexts/project-context";
import { useAutomationJob, type BulkQueueItemPersisted, type PersistedBulkJob } from "@/contexts/automation-job-context";
import { startMaestroRun, resumeMaestroJob, cancelMaestroJob } from "@/lib/maestro-agent";
import { updateRunCaseStatus } from "@/lib/run-case-status";
import { recordAutomatedFailure } from "@/lib/automated-failures";
import { DeviceMirrorButton } from "@/pages/test-runs/device-mirror-button";
import type { TestRunCase } from "@/types/test-runs";
import type { TestSuite } from "@/types/test-cases";

interface BulkRunModalProps {
  open: boolean;
  onClose: () => void;
  runId: string;
  cases: TestRunCase[];
  suites: TestSuite[];
  onFinished: () => void;
}

function buildInitialQueue(cases: TestRunCase[]): BulkQueueItemPersisted[] {
  return cases.map((rc) => ({ runCase: rc, status: "pending" }));
}

function BulkRunModal({ open, onClose, runId, cases, suites, onFinished }: BulkRunModalProps) {
  const { user } = useAuth();
  const { activeProject } = useProject();
  const { bulkJob, saveBulkJob } = useAutomationJob();

  const [queue, setQueue] = React.useState<BulkQueueItemPersisted[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [cancelled, setCancelled] = React.useState(false);
  const runningRef = React.useRef(false);
  const queueRef = React.useRef<BulkQueueItemPersisted[]>([]);
  const currentIndexRef = React.useRef(0);
  const activeJobIdRef = React.useRef<string | null>(null);
  const cancelledRef = React.useRef(false);

  const suiteTitleById = React.useMemo(() => {
    const map: Record<string, string> = {};
    suites.forEach((s) => (map[s.id] = s.title));
    return map;
  }, [suites]);

  function persist(nextQueue: BulkQueueItemPersisted[], nextIndex: number, jobId: string | null) {
    if (!activeProject) return;
    const job: PersistedBulkJob = {
      runId,
      projectId: activeProject.id,
      jobId,
      queue: nextQueue,
      currentIndex: nextIndex,
      startedAt: bulkJob?.runId === runId ? bulkJob.startedAt : Date.now(),
    };
    saveBulkJob(job);
  }

  function setQueueAndPersist(nextQueue: BulkQueueItemPersisted[], nextIndex: number, jobId: string | null) {
    queueRef.current = nextQueue;
    currentIndexRef.current = nextIndex;
    setQueue(nextQueue);
    setCurrentIndex(nextIndex);
    persist(nextQueue, nextIndex, jobId);
  }

  function patchCurrent(patch: Partial<BulkQueueItemPersisted>, jobId: string | null) {
    const next = queueRef.current.map((item, i) => (i === currentIndexRef.current ? { ...item, ...patch } : item));
    queueRef.current = next;
    setQueue(next);
    persist(next, currentIndexRef.current, jobId);
  }

  React.useEffect(() => {
    if (!open) return;
    setCancelled(false);
    cancelledRef.current = false;
    runningRef.current = false;

    if (bulkJob && bulkJob.runId === runId) {
      queueRef.current = bulkJob.queue;
      currentIndexRef.current = bulkJob.currentIndex;
      setQueue(bulkJob.queue);
      setCurrentIndex(bulkJob.currentIndex);
      if (bulkJob.jobId) {
        reconnectToJob(bulkJob.jobId);
      }
    } else {
      const initial = buildInitialQueue(cases);
      setQueueAndPersist(initial, 0, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const finished = queue.length > 0 && currentIndex >= queue.length;

  React.useEffect(() => {
    if (!open || cancelled || finished || runningRef.current) return;
    if (queue.length === 0) return;
    runCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentIndex, cancelled, queue.length, finished]);

  React.useEffect(() => {
    if (finished && open) {
      saveBulkJob(null);
      onFinished();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  async function reconnectToJob(jobId: string) {
    runningRef.current = true;
    activeJobIdRef.current = jobId;
    const result = await resumeMaestroJob(jobId);
    await handleJobResult(result);
  }

  async function runCurrent() {
    runningRef.current = true;
    patchCurrent({ status: "running" }, null);
    const item = queueRef.current[currentIndexRef.current];
    const scriptPath = item.runCase.test_cases.automation_script_path!;

    const started = await startMaestroRun(scriptPath);
    if (!started.ok) {
      patchCurrent({ status: "error", errorMessage: started.error }, null);
      toast.error(`Erro ao executar "${item.runCase.test_cases.title}": ${started.error}`);
      runningRef.current = false;
      advanceIndex();
      return;
    }

    activeJobIdRef.current = started.jobId;
    patchCurrent({}, started.jobId);
    const result = await resumeMaestroJob(started.jobId);
    await handleJobResult(result);
  }

  async function handleJobResult(result: Awaited<ReturnType<typeof resumeMaestroJob>>) {
    activeJobIdRef.current = null;
    // A fila já foi cancelada enquanto esse teste rodava — o processo já foi
    // morto no agente, e a tela já foi fechada; não faz sentido gravar nada
    // nem avançar pra um próximo teste que o usuário já disse que não quer.
    if (cancelledRef.current) return;

    const item = queueRef.current[currentIndexRef.current];

    if (!result.ok) {
      patchCurrent({ status: "error", errorMessage: result.error }, null);
      toast.error(result.error);
      runningRef.current = false;
      advanceIndex();
      return;
    }

    patchCurrent(
      { status: result.status, output: result.output, screenshotBase64: result.screenshotBase64, duration: result.duration },
      null
    );

    if (result.status === "cancelled") {
      runningRef.current = false;
      return;
    }

    if (result.status === "passed") {
      await updateRunCaseStatus(
        item.runCase.id,
        {
          status: "passed",
          executed_at: new Date().toISOString(),
          executed_by: user?.id,
          duration_seconds: result.duration,
        },
        "automated"
      );
    } else {
      // Não pausa mais a fila pra decidir bug — grava o registro de falha
      // (log + print + duração) e segue direto pro próximo teste. A
      // triagem (virar defeito, marcar flaky, rerodar) acontece depois, na
      // aba "Falhas automatizadas".
      await updateRunCaseStatus(
        item.runCase.id,
        {
          status: "failed",
          executed_at: new Date().toISOString(),
          executed_by: user?.id,
          duration_seconds: result.duration,
        },
        "automated"
      );
      if (activeProject) {
        await recordAutomatedFailure({
          runCaseId: item.runCase.id,
          projectId: activeProject.id,
          testCaseTitle: item.runCase.test_cases.title,
          durationSeconds: result.duration,
          output: result.output,
          screenshotBase64: result.screenshotBase64,
          userId: user?.id,
        });
      }
    }
    runningRef.current = false;
    advanceIndex();
  }

  function advanceIndex() {
    const nextIndex = currentIndexRef.current + 1;
    currentIndexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
    persist(queueRef.current, nextIndex, null);
  }

  function handleCancel() {
    cancelledRef.current = true;
    setCancelled(true);
    if (activeJobIdRef.current) {
      // Fogo e esquece — não precisa esperar a resposta pra fechar a tela,
      // mas isso É o que garante que o teste pare de rodar de verdade.
      void cancelMaestroJob(activeJobIdRef.current);
    }
    saveBulkJob(null);
    onClose();
  }

  const passedCount = queue.filter((q) => q.status === "passed").length;
  const failedCount = queue.filter((q) => q.status === "failed" || q.status === "error").length;
  const current = queue[currentIndex];

  function labelFor(item: BulkQueueItemPersisted) {
    const suiteId = item.runCase.test_cases.suite_id;
    const suiteTitle = suiteId ? suiteTitleById[suiteId] : undefined;
    return suiteTitle ? `${suiteTitle} — ${item.runCase.test_cases.title}` : item.runCase.test_cases.title;
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={handleCancel}
        width="xl"
        closeOnOutsideClick={false}
        title="Executar automatizados"
        subtitle={
          !finished && current ? (
            <>
              Rodando <strong className="text-foreground">{currentIndex + 1}</strong> de{" "}
              <strong className="text-foreground">{queue.length}</strong>:{" "}
              <span className="text-foreground font-medium">{labelFor(current)}</span>
            </>
          ) : finished ? (
            <>
              Concluído — <strong className="text-emerald-600">{passedCount} passou(aram)</strong>
              {failedCount > 0 && (
                <>
                  , <strong className="text-red-600">{failedCount} falhou(aram)</strong>
                </>
              )}
              .
            </>
          ) : undefined
        }
        headerActions={<DeviceMirrorButton />}
        footer={
          finished ? (
            <Button onClick={onClose}>Fechar</Button>
          ) : (
            <Button variant="secondary" onClick={handleCancel}>
              Cancelar fila
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-4">
          {cancelled && !finished && <p className="text-sm text-amber-600">Fila cancelada.</p>}

          <div className="flex flex-col gap-1 rounded-lg border border-border">
            {queue.map((item, i) => (
              <div
                key={item.runCase.id}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-sm border-b border-border last:border-0",
                  i === currentIndex && !finished && "bg-muted/50"
                )}
              >
                {item.status === "pending" && <Circle size={15} className="text-muted-foreground shrink-0" />}
                {item.status === "running" && <Loader2 size={15} className="text-brand shrink-0 animate-spin" />}
                {item.status === "passed" && <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />}
                {(item.status === "failed" || item.status === "error") && (
                  <XCircle size={15} className="text-red-600 shrink-0" />
                )}
                {item.status === "cancelled" && <XCircle size={15} className="text-amber-600 shrink-0" />}
                <span className="truncate flex-1">{labelFor(item)}</span>
                {item.duration !== undefined && (
                  <span className="font-mono-table text-xs text-muted-foreground shrink-0">{item.duration}s</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </Drawer>
    </>
  );
}

export { BulkRunModal };
