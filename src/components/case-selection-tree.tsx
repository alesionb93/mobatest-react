import * as React from "react";
import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import type { TestSuite } from "@/types/test-cases";
import type { PlanCaseRef } from "@/types/test-plans";

interface CaseSelectionTreeProps {
  suites: TestSuite[];
  cases: PlanCaseRef[];
  projectCode: string;
  selectedIds: Set<string>;
  onChange: (ids: Set<string>) => void;
}

function CaseSelectionTree({ suites, cases, projectCode, selectedIds, onChange }: CaseSelectionTreeProps) {
  const [collapsedIds, setCollapsedIds] = React.useState<Set<string>>(new Set());

  const byParent = React.useMemo(() => {
    const map: Record<string, TestSuite[]> = {};
    suites.forEach((s) => {
      const key = s.parent_suite_id ?? "root";
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [suites]);

  const casesBySuite = React.useMemo(() => {
    const map: Record<string, PlanCaseRef[]> = {};
    cases.forEach((c) => {
      const key = c.suite_id ?? "none";
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return map;
  }, [cases]);

  function getAllCaseIdsUnder(suiteId: string): string[] {
    let ids = (casesBySuite[suiteId] ?? []).map((c) => c.id);
    (byParent[suiteId] ?? []).forEach((child) => {
      ids = ids.concat(getAllCaseIdsUnder(child.id));
    });
    return ids;
  }

  function toggleCollapsed(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCase(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  function toggleSuite(suiteId: string, checked: boolean) {
    const ids = getAllCaseIdsUnder(suiteId);
    const next = new Set(selectedIds);
    ids.forEach((id) => (checked ? next.add(id) : next.delete(id)));
    onChange(next);
  }

  function renderSuiteNode(suite: TestSuite, depth: number) {
    const children = byParent[suite.id] ?? [];
    const directCases = casesBySuite[suite.id] ?? [];
    const allIds = getAllCaseIdsUnder(suite.id);
    const selectedCount = allIds.filter((id) => selectedIds.has(id)).length;
    const checked = allIds.length > 0 && selectedCount === allIds.length;
    const indeterminate = selectedCount > 0 && selectedCount < allIds.length;
    const collapsed = collapsedIds.has(suite.id);

    return (
      <div key={suite.id}>
        <div className="flex items-center gap-2 py-1" style={{ paddingLeft: depth * 18 }}>
          <button
            onClick={() => toggleCollapsed(suite.id)}
            className="shrink-0 text-muted-foreground"
            title="Recolher/expandir"
          >
            <ChevronRight size={14} className={cn("transition-transform", !collapsed && "rotate-90")} />
          </button>
          <Checkbox
            checked={indeterminate ? "indeterminate" : checked}
            onCheckedChange={(v) => toggleSuite(suite.id, v)}
            aria-label={`Selecionar todos os casos de ${suite.title}`}
          />
          {collapsed ? (
            <Folder size={14} className="shrink-0 text-muted-foreground" />
          ) : (
            <FolderOpen size={14} className="shrink-0 text-muted-foreground" />
          )}
          <span className="flex-1 font-medium text-sm truncate" title={suite.title}>
            {suite.title}
          </span>
          <span className="text-xs text-muted-foreground">{allIds.length}</span>
        </div>
        {!collapsed && (
          <div>
            {directCases.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 py-1 cursor-pointer hover:bg-accent/40 rounded-md"
                style={{ paddingLeft: (depth + 1) * 18 }}
              >
                <Checkbox
                  checked={selectedIds.has(c.id)}
                  onCheckedChange={() => toggleCase(c.id)}
                  aria-label={`Selecionar ${c.title}`}
                />
                <span className="font-mono-table text-xs text-muted-foreground shrink-0">
                  {projectCode}-{c.seq}
                </span>
                <span className="text-sm truncate">{c.title}</span>
              </label>
            ))}
            {children.map((child) => renderSuiteNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  const rootSuites = byParent["root"] ?? [];
  const noSuiteCases = casesBySuite["none"] ?? [];

  if (cases.length === 0) {
    return <p className="text-sm text-muted-foreground p-2">Nenhum caso de teste disponível neste projeto.</p>;
  }

  return (
    <div className="max-h-80 overflow-y-auto rounded-lg border border-border p-2">
      {rootSuites.map((s) => renderSuiteNode(s, 0))}
      {noSuiteCases.length > 0 && (
        <div>
          <div className="flex items-center gap-2 py-1">
            <span className="w-3.5 shrink-0" />
            <Checkbox
              checked={
                noSuiteCases.every((c) => selectedIds.has(c.id))
                  ? true
                  : noSuiteCases.some((c) => selectedIds.has(c.id))
                    ? "indeterminate"
                    : false
              }
              onCheckedChange={(v) => {
                const next = new Set(selectedIds);
                noSuiteCases.forEach((c) => (v ? next.add(c.id) : next.delete(c.id)));
                onChange(next);
              }}
              aria-label="Selecionar casos sem suíte"
            />
            <Folder size={14} className="shrink-0 text-muted-foreground" />
            <span className="flex-1 font-medium text-sm">Sem suíte</span>
            <span className="text-xs text-muted-foreground">{noSuiteCases.length}</span>
          </div>
          {noSuiteCases.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-2 py-1 pl-[18px] cursor-pointer hover:bg-accent/40 rounded-md"
            >
              <Checkbox
                checked={selectedIds.has(c.id)}
                onCheckedChange={() => toggleCase(c.id)}
                aria-label={`Selecionar ${c.title}`}
              />
              <span className="font-mono-table text-xs text-muted-foreground shrink-0">
                {projectCode}-{c.seq}
              </span>
              <span className="text-sm truncate">{c.title}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export { CaseSelectionTree };
