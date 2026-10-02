import * as React from "react";
import { ChevronRight, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ProgressSegments } from "@/pages/test-runs/progress-segments";
import { formatDuration, profileName, type SuiteGroup } from "@/pages/test-runs/run-helpers";
import { statusBadgeVariant, statusLabel } from "@/lib/labels";
import type { Profile, TestRunCase } from "@/types/test-runs";

interface CasesTabProps {
  groups: SuiteGroup[];
  projectCode: string;
  profiles: Record<string, Profile>;
  currentUserId?: string;
  onOpenCase: (runCaseId: string) => void;
  onAssignSelected: (ids: string[]) => void;
  onUnassignSelected: (ids: string[]) => void;
  onRemoveSelected: (ids: string[]) => void;
  onRunAutomatedSelected: (cases: TestRunCase[]) => void;
}

function CasesTab({
  groups,
  projectCode,
  profiles,
  currentUserId,
  onOpenCase,
  onAssignSelected,
  onUnassignSelected,
  onRemoveSelected,
  onRunAutomatedSelected,
}: CasesTabProps) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [collapsedSuites, setCollapsedSuites] = React.useState<Set<string>>(new Set());

  const allIds = React.useMemo(() => groups.flatMap((g) => g.cases.map((c) => c.id)), [groups]);
  const allSelected = allIds.length > 0 && selected.size === allIds.length;
  const someSelected = selected.size > 0 && !allSelected;

  const selectedCases = React.useMemo(
    () => groups.flatMap((g) => g.cases).filter((c) => selected.has(c.id)),
    [groups, selected]
  );
  const selectedAutomatedCases = React.useMemo(
    () => selectedCases.filter((c) => c.test_cases.automation_status === "automated" && c.test_cases.automation_script_path),
    [selectedCases]
  );

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSuite(group: SuiteGroup, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      group.cases.forEach((c) => (checked ? next.add(c.id) : next.delete(c.id)));
      return next;
    });
  }
  function toggleCollapsed(key: string) {
    setCollapsedSuites((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={toggleAll}
            aria-label="Selecionar todos"
          />
          Selecionar todos
        </label>
        <div className="flex-1" />
        <Button
          variant="secondary"
          size="sm"
          disabled={selectedAutomatedCases.length === 0}
          onClick={() => onRunAutomatedSelected(selectedAutomatedCases)}
          title={
            selected.size > 0 && selectedAutomatedCases.length < selected.size
              ? `${selectedAutomatedCases.length} de ${selected.size} selecionado(s) são automatizados`
              : undefined
          }
        >
          <Play size={14} /> Executar automatizados{selectedAutomatedCases.length > 0 ? ` (${selectedAutomatedCases.length})` : ""}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={selected.size === 0}
          onClick={() => onAssignSelected(Array.from(selected))}
        >
          Atribuir para mim
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={selected.size === 0}
          onClick={() => onUnassignSelected(Array.from(selected))}
        >
          Desatribuir
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={selected.size === 0}
          onClick={() => onRemoveSelected(Array.from(selected))}
        >
          Remover
        </Button>
      </div>

      {groups.map((g) => {
        const collapsed = collapsedSuites.has(g.key);
        const suiteDuration = g.cases.reduce((sum, rc) => sum + (rc.duration_seconds ?? 0), 0);
        const suiteSelectedCount = g.cases.filter((c) => selected.has(c.id)).length;

        return (
          <div key={g.key} className="rounded-xl border border-border bg-card overflow-hidden">
            <div
              onClick={() => toggleCollapsed(g.key)}
              className="flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40"
              style={{ paddingLeft: 12 + g.depth * 18 }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <ChevronRight size={14} className={cn("shrink-0 text-muted-foreground transition-transform", !collapsed && "rotate-90")} />
                <span onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={
                      suiteSelectedCount === g.cases.length ? true : suiteSelectedCount > 0 ? "indeterminate" : false
                    }
                    onCheckedChange={(v) => toggleSuite(g, v)}
                    aria-label={`Selecionar todos de ${g.title}`}
                  />
                </span>
                <span className="text-sm font-medium truncate">{g.title}</span>
                <span className="text-xs text-muted-foreground">({g.cases.length})</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono-table text-xs text-muted-foreground">{formatDuration(suiteDuration)}</span>
                <div className="w-32">
                  <ProgressSegments statuses={g.cases.map((c) => c.status)} />
                </div>
              </div>
            </div>

            {!collapsed && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>ID</TableHead>
                    <TableHead>Membro</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Caso de teste</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Prioridade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.cases.map((rc) => (
                    <TableRow key={rc.id} className="cursor-pointer" onClick={() => onOpenCase(rc.id)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(rc.id)}
                          onCheckedChange={() => toggleOne(rc.id)}
                          aria-label={rc.test_cases.title}
                        />
                      </TableCell>
                      <TableCell className="font-mono-table text-xs text-muted-foreground">
                        {projectCode}-{rc.test_cases.seq}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {profileName(rc.assignee_id, profiles, currentUserId)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant={statusBadgeVariant(rc.status)}>{statusLabel(rc.status)}</Badge>
                          {rc.retest_count > 0 && (
                            <span
                              className="text-xs font-medium text-muted-foreground"
                              title={`Retestado ${rc.retest_count} vez(es) nesta execução`}
                            >
                              +{rc.retest_count}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{rc.test_cases.title}</TableCell>
                      <TableCell className="font-mono-table text-xs text-muted-foreground">
                        {formatDuration(rc.duration_seconds)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(rc.test_cases.priority)}>{statusLabel(rc.test_cases.priority)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { CasesTab };
