import * as React from "react";
import { Search, Plus, Upload, Download, Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { HistoryStrip } from "@/pages/test-cases/history-strip";
import { statusBadgeVariant, statusLabel, PRIORITY_OPTIONS, AUTOMATION_OPTIONS, toSelectOptions } from "@/lib/labels";
import type { TestCase, TestSuite, RunCaseStatus } from "@/types/test-cases";

interface CaseTableProps {
  cases: TestCase[];
  suites: TestSuite[];
  projectCode: string;
  historyByCase: Record<string, RunCaseStatus[]>;
  onOpenCase: (testCase: TestCase) => void;
  onNewCase: () => void;
  onImportCSV: () => void;
  onExportCSV: (cases: TestCase[]) => void;
  onDuplicate: (testCase: TestCase) => void;
  onBulkUpdate: (ids: string[], patch: Record<string, string>) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
}

function CaseTable({
  cases,
  suites,
  projectCode,
  historyByCase,
  onOpenCase,
  onNewCase,
  onImportCSV,
  onExportCSV,
  onDuplicate,
  onBulkUpdate,
  onBulkDelete,
  searchTerm,
  onSearchTermChange,
}: CaseTableProps) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = React.useState(false);

  React.useEffect(() => {
    // Limpa seleção quando a lista de casos visível muda de conjunto (ex: trocou de suíte)
    setSelected(new Set());
  }, [cases.map((c) => c.id).join(",")]);

  const allSelected = cases.length > 0 && selected.size === cases.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(cases.map((c) => c.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const suiteOptions = [{ value: "", label: "Mover para..." }, ...suites.map((s) => ({ value: s.id, label: s.title }))];

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="Buscar por título..."
            className="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={onImportCSV}>
          <Upload size={14} /> Importar CSV
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onExportCSV(cases)}>
          <Download size={14} /> Exportar CSV
        </Button>
        <Button size="sm" onClick={onNewCase}>
          <Plus size={14} /> Novo caso
        </Button>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2">
          <span className="text-sm font-medium text-foreground mr-1">{selected.size} selecionado(s)</span>
          <Select
            value=""
            onChange={(v) => v && onBulkUpdate(Array.from(selected), { suite_id: v })}
            options={suiteOptions}
            className="w-40"
          />
          <Select
            value=""
            onChange={(v) => v && onBulkUpdate(Array.from(selected), { priority: v })}
            options={[{ value: "", label: "Prioridade..." }, ...toSelectOptions(PRIORITY_OPTIONS)]}
            className="w-36"
          />
          <Select
            value=""
            onChange={(v) => v && onBulkUpdate(Array.from(selected), { automation_status: v })}
            options={[{ value: "", label: "Automação..." }, ...toSelectOptions(AUTOMATION_OPTIONS)]}
            className="w-36"
          />
          <Button variant="danger" size="sm" onClick={() => setConfirmBulkDelete(true)}>
            <Trash2 size={14} /> Excluir
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {cases.length === 0 ? (
          <EmptyState message="Nenhum caso de teste encontrado. Crie o primeiro ou importe via CSV." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Selecionar todos"
                  />
                </TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Automação</TableHead>
                <TableHead>Histórico</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => onOpenCase(c)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={() => toggleOne(c.id)}
                      aria-label={`Selecionar ${c.title}`}
                    />
                  </TableCell>
                  <TableCell className="font-mono-table text-xs text-muted-foreground">
                    {projectCode}-{c.seq}
                  </TableCell>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(c.priority)}>{statusLabel(c.priority)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(c.severity)}>{statusLabel(c.severity)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(c.automation_status)}>{statusLabel(c.automation_status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <HistoryStrip results={historyByCase[c.id] ?? []} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onDuplicate(c)}
                      className="text-muted-foreground hover:text-foreground rounded p-1"
                      title="Duplicar"
                    >
                      <Copy size={14} />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Modal
        open={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        title="Excluir casos selecionados"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmBulkDelete(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await onBulkDelete(Array.from(selected));
                setSelected(new Set());
                setConfirmBulkDelete(false);
              }}
            >
              Excluir {selected.size} caso(s)
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Essa ação não pode ser desfeita.</p>
      </Modal>
    </div>
  );
}

export { CaseTable };
