import * as React from "react";
import { toast } from "sonner";
import { Bug, Zap, RefreshCw, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { getFailureScreenshotUrl } from "@/lib/automated-failures";
import { checkCaseFlakiness, type FlakinessResult } from "@/lib/flakiness";
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
  /** Avisa o componente pai quais falhas estão selecionadas (pra exportar só essas) */
  onSelectionChange?: (selected: FailureRow[]) => void;
}

function AutomatedFailuresList({ failures, onReload, showRunColumn = false, onSelectionChange }: AutomatedFailuresListProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [screenshotUrls, setScreenshotUrls] = React.useState<Record<string, string>>({});
  const [flakiness, setFlakiness] = React.useState<Record<string, FlakinessResult>>({});
  const [bugModalFor, setBugModalFor] = React.useState<{ failureId: string; runCase: TestRunCase } | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const allSelected = failures.length > 0 && selected.size === failures.length;
  const someSelected = selected.size > 0 && !allSelected;

  function updateSelection(next: Set<string>) {
    setSelected(next);
    onSelectionChange?.(failures.filter((f) => next.has(f.id)));
  }

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateSelection(next);
  }

  function toggleAll() {
    updateSelection(allSelected ? new Set() : new Set(failures.map((f) => f.id)));
  }

  const failureIdsKey = failures.map((f) => f.id).join(",");
  React.useEffect(() => {
    setSelected(new Set());
    onSelectionChange?.([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failureIdsKey]);

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
    if (f.test_run_case?.test_case_id && !flakiness[f.id]) {
      const result = await checkCaseFlakiness(f.test_run_case.test_case_id);
      setFlakiness((prev) => ({ ...prev, [f.id]: result }));
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
      {failures.length > 0 && (
        <div className="flex items-center gap-2 px-1 pb-1">
          <Checkbox
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={toggleAll}
            aria-label="Selecionar todas as falhas"
          />
          <span className="text-xs text-muted-foreground">
            {selected.size > 0 ? `${selected.size} selecionada(s)` : "Selecionar tudo"}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {failures.map((f) => (
          <div key={f.id} className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selected.has(f.id)}
                  onCheckedChange={() => toggleOne(f.id)}
                  aria-label={`Selecionar "${f.test_case_title}"`}
                />
              </div>
              <button onClick={() => toggleExpand(f)} className="flex-1 min-w-0 flex items-center gap-3 text-left">
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
            </div>

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

                {flakiness[f.id]?.isFlaky && f.status === "new" && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                    ⚠️ Esse caso alternou passou/falhou {flakiness[f.id].alternations}x nas últimas{" "}
                    {flakiness[f.id].windowSize} execuções — pode ser flaky, não necessariamente um bug novo.
                  </p>
                )}

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
