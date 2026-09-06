import * as React from "react";
import { toast } from "sonner";
import { Bug, Zap, RefreshCw, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { getFailureScreenshotUrl } from "@/lib/automated-failures";
import { MaestroLogView } from "@/pages/test-runs/maestro-log-view";
import { AddBugModal } from "@/pages/test-runs/add-bug-modal";
import type { AutomatedFailure, TestRunCase } from "@/types/test-runs";

export interface FailureRow extends AutomatedFailure {
  test_run_case: { id: string; test_case_id: string; test_run_id: string; test_run?: { title: string } | null } | null;
}

const STATUS_LABEL: Record<AutomatedFailure["status"], string> = {
  new: "Novo",
  flaky: "Flaky",
  promoted: "Virou defeito",
  ignored: "Ignorado",
};

const STATUS_VARIANT: Record<AutomatedFailure["status"], "warning" | "neutral" | "danger" | "success"> = {
  new: "warning",
  flaky: "neutral",
  promoted: "success",
  ignored: "neutral",
};

interface AutomatedFailuresListProps {
  failures: FailureRow[];
  onReload: () => void;
  /** Mostra de qual execução veio cada falha — usado na visão global do módulo */
  showRunColumn?: boolean;
}

function AutomatedFailuresList({ failures, onReload, showRunColumn = false }: AutomatedFailuresListProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [screenshotUrls, setScreenshotUrls] = React.useState<Record<string, string>>({});
  const [bugModalFor, setBugModalFor] = React.useState<{ failureId: string; runCase: TestRunCase } | null>(null);

  async function toggleExpand(f: FailureRow) {
    if (expandedId === f.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(f.id);
    if (f.screenshot_path && !screenshotUrls[f.id]) {
      const url = await getFailureScreenshotUrl(f.screenshot_path);
      if (url) setScreenshotUrls((prev) => ({ ...prev, [f.id]: url }));
    }
  }

  async function markFlaky(f: FailureRow) {
    const { error } = await supabase.from("automated_failures").update({ status: "flaky" }).eq("id", f.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Marcado como flaky.");
    onReload();
  }

  function openCreateDefect(f: FailureRow) {
    if (!f.test_run_case) return;
    setBugModalFor({
      failureId: f.id,
      runCase: {
        id: f.test_run_case.id,
        test_run_id: f.test_run_case.test_run_id,
        test_case_id: f.test_run_case.test_case_id,
        status: "failed",
        comment: null,
        duration_seconds: f.duration_seconds,
        executed_by: null,
        executed_at: f.occurred_at,
        assignee_id: null,
        retest_count: 0,
        test_cases: { title: f.test_case_title, seq: 0, priority: "medium", suite_id: null },
      } as TestRunCase,
    });
  }

  if (failures.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <EmptyState message="Nenhuma falha automatizada registrada ainda." />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {failures.map((f) => (
          <div key={f.id} className="rounded-lg border border-border bg-card overflow-hidden">
            <button
              onClick={() => toggleExpand(f)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
            >
              <ChevronDown
                size={16}
                className={cn("text-muted-foreground shrink-0 transition-transform", expandedId === f.id && "rotate-180")}
              />
              <span className="flex-1 min-w-0 truncate text-sm font-medium text-foreground">{f.test_case_title}</span>
              {showRunColumn && f.test_run_case?.test_run && (
                <Link
                  to={`/test-runs/${f.test_run_case.test_run_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-brand hover:underline shrink-0 max-w-[160px] truncate"
                >
                  {f.test_run_case.test_run.title}
                </Link>
              )}
              <span className="font-mono-table text-xs text-muted-foreground shrink-0">
                {f.duration_seconds ? `${f.duration_seconds}s` : "—"}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(f.occurred_at).toLocaleString("pt-BR")}
              </span>
              <Badge variant={STATUS_VARIANT[f.status]}>{STATUS_LABEL[f.status]}</Badge>
            </button>

            {expandedId === f.id && (
              <div className="border-t border-border p-4 flex flex-col gap-3">
                {screenshotUrls[f.id] && (
                  <img
                    src={screenshotUrls[f.id]}
                    alt="Print do momento da falha"
                    className="max-h-56 w-fit rounded-md border border-border cursor-zoom-in"
                    onClick={() => window.open(screenshotUrls[f.id], "_blank")}
                  />
                )}
                <MaestroLogView output={f.output ?? ""} />

                {f.status === "new" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" onClick={() => openCreateDefect(f)}>
                      <Bug size={14} /> Criar defeito
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => markFlaky(f)}>
                      <Zap size={14} /> Marcar como flaky
                    </Button>
                  </div>
                )}
                {f.status === "flaky" && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <RefreshCw size={12} /> Marcado como instável — não virou defeito.
                  </p>
                )}
                {f.status === "promoted" && (
                  <p className="text-xs text-muted-foreground">Já foi transformado em defeito.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {bugModalFor && (
        <AddBugModal
          open
          onClose={() => setBugModalFor(null)}
          runCase={bugModalFor.runCase}
          automatedLog={failures.find((f) => f.id === bugModalFor.failureId)?.output ?? undefined}
          onDefectCreated={async (defectId) => {
            await supabase
              .from("automated_failures")
              .update({ status: "promoted", defect_id: defectId })
              .eq("id", bugModalFor.failureId);
          }}
          onDone={async () => {
            setBugModalFor(null);
            onReload();
          }}
        />
      )}
    </>
  );
}

export { AutomatedFailuresList };
