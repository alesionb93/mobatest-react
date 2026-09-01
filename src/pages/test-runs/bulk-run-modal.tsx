import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { AddBugModal } from "@/pages/test-runs/add-bug-modal";
import type { TestRunCase } from "@/types/test-runs";

const MAESTRO_AGENT_URL = "http://127.0.0.1:4545/run";

type ItemStatus = "pending" | "running" | "passed" | "failed" | "error";

interface QueueItem {
  runCase: TestRunCase;
  status: ItemStatus;
  output?: string;
  screenshotBase64?: string | null;
  duration?: number;
  errorMessage?: string;
}

interface BulkRunModalProps {
  open: boolean;
  onClose: () => void;
  cases: TestRunCase[];
  onFinished: () => void;
}

function BulkRunModal({ open, onClose, cases, onFinished }: BulkRunModalProps) {
  const { user } = useAuth();
  const [queue, setQueue] = React.useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [cancelled, setCancelled] = React.useState(false);
  const [bugModalOpen, setBugModalOpen] = React.useState(false);
  const [bugModalKey, setBugModalKey] = React.useState(0);
  const runningRef = React.useRef(false);

  React.useEffect(() => {
    if (!open) return;
    setQueue(cases.map((rc) => ({ runCase: rc, status: "pending" })));
    setCurrentIndex(0);
    setCancelled(false);
    setBugModalOpen(false);
    runningRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const finished = queue.length > 0 && currentIndex >= queue.length;

  React.useEffect(() => {
    if (!open || cancelled || bugModalOpen || finished || runningRef.current) return;
    if (queue.length === 0) return;
    runCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentIndex, cancelled, bugModalOpen, queue.length, finished]);

  React.useEffect(() => {
    if (finished && open) onFinished();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  function updateCurrent(patch: Partial<QueueItem>) {
    setQueue((q) => q.map((item, i) => (i === currentIndex ? { ...item, ...patch } : item)));
  }

  async function runCurrent() {
    runningRef.current = true;
    updateCurrent({ status: "running" });
    const item = queue[currentIndex];
    const scriptPath = item.runCase.test_cases.automation_script_path!;

    try {
      const res = await fetch(MAESTRO_AGENT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptPath }),
      });
      const data = await res.json();

      if (!data.ok) {
        updateCurrent({ status: "error", errorMessage: data.error });
        toast.error(`Erro ao executar "${item.runCase.test_cases.title}": ${data.error}`);
        runningRef.current = false;
        setCurrentIndex((i) => i + 1);
        return;
      }

      updateCurrent({
        status: data.status,
        output: data.output ?? "",
        screenshotBase64: data.screenshotBase64 ?? null,
        duration: data.duration,
      });

      if (data.status === "passed") {
        await supabase
          .from("test_run_cases")
          .update({
            status: "passed",
            executed_at: new Date().toISOString(),
            executed_by: user?.id,
            duration_seconds: data.duration,
          })
          .eq("id", item.runCase.id);
        runningRef.current = false;
        setCurrentIndex((i) => i + 1);
      } else {
        // Pausa aqui — só avança depois que o defeito for salvo (ou pulado).
        setBugModalKey((k) => k + 1);
        setBugModalOpen(true);
      }
    } catch {
      updateCurrent({ status: "error", errorMessage: "Não consegui conectar ao executor local." });
      toast.error("Não consegui conectar ao executor local — a fila foi pausada.");
      setCancelled(true);
      runningRef.current = false;
    }
  }

  async function handleBugDone(extra: Record<string, unknown>) {
    const item = queue[currentIndex];
    await supabase
      .from("test_run_cases")
      .update({
        status: "failed",
        executed_at: new Date().toISOString(),
        executed_by: user?.id,
        duration_seconds: item.duration,
        ...extra,
      })
      .eq("id", item.runCase.id);
    setBugModalOpen(false);
    runningRef.current = false;
    setCurrentIndex((i) => i + 1);
  }

  function handleSkipBug() {
    // Marca como falhou sem criar defeito agora — segue pro próximo.
    setBugModalOpen(false);
    void handleBugDone({});
  }

  const passedCount = queue.filter((q) => q.status === "passed").length;
  const failedCount = queue.filter((q) => q.status === "failed" || q.status === "error").length;
  const current = queue[currentIndex];

  return (
    <>
      <Modal
        open={open}
        onClose={() => {
          setCancelled(true);
          onClose();
        }}
        title="Executar automatizados"
        size="lg"
        closeOnOutsideClick={false}
        footer={
          finished ? (
            <Button onClick={onClose}>Fechar</Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => {
                setCancelled(true);
                onClose();
              }}
            >
              Cancelar fila
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-4">
          {!finished && current && (
            <p className="text-sm text-muted-foreground">
              Rodando <strong className="text-foreground">{currentIndex + 1}</strong> de{" "}
              <strong className="text-foreground">{queue.length}</strong>:{" "}
              <span className="text-foreground font-medium">{current.runCase.test_cases.title}</span>
            </p>
          )}
          {finished && (
            <p className="text-sm text-foreground">
              Concluído — <strong className="text-emerald-600">{passedCount} passou(aram)</strong>
              {failedCount > 0 && (
                <>
                  , <strong className="text-red-600">{failedCount} falhou(aram)</strong>
                </>
              )}
              .
            </p>
          )}
          {cancelled && !finished && <p className="text-sm text-amber-600">Fila cancelada.</p>}

          <div className="flex flex-col gap-1 max-h-80 overflow-y-auto rounded-lg border border-border">
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
                <span className="truncate flex-1">{item.runCase.test_cases.title}</span>
                {item.duration !== undefined && (
                  <span className="font-mono-table text-xs text-muted-foreground shrink-0">{item.duration}s</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {current && (
        <AddBugModal
          key={bugModalKey}
          open={bugModalOpen}
          onClose={handleSkipBug}
          runCase={current.runCase}
          automatedLog={current.output}
          automatedScreenshotBase64={current.screenshotBase64}
          onDone={handleBugDone}
        />
      )}
    </>
  );
}

export { BulkRunModal };
