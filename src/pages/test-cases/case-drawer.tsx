import * as React from "react";
import { Copy, Trash2 } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CollapsibleField } from "@/components/ui/collapsible-field";
import { EmptyState } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { HistoryStrip } from "@/pages/test-cases/history-strip";
import { ScriptPathField } from "@/pages/test-cases/script-path-field";
import { supabase } from "@/lib/supabase";
import {
  PRIORITY_OPTIONS,
  SEVERITY_OPTIONS,
  AUTOMATION_OPTIONS,
  TEST_TYPE_OPTIONS,
  statusBadgeVariant,
  statusLabel,
  toSelectOptions,
} from "@/lib/labels";
import type { TestCase, TestSuite, RunCaseStatus, CaseStatus } from "@/types/test-cases";

const BDD_TEMPLATE = "<p><strong>Dado que</strong></p><p><strong>Quando</strong></p><p><strong>Então</strong></p>";
const CASE_STATUS_OPTIONS = ["active", "draft", "deprecated"] as const;

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}
function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "não executado";
  return new Date(iso).toLocaleString("pt-BR");
}

interface CaseDrawerProps {
  open: boolean;
  onClose: () => void;
  existing: TestCase | null;
  initialTitle?: string;
  defaultSuiteId: string | null;
  suites: TestSuite[];
  projectCode: string;
  history: RunCaseStatus[];
  onCreate: (input: Record<string, unknown>) => Promise<void>;
  onSave: (id: string, input: Record<string, unknown>) => Promise<void>;
  onDuplicate: (testCase: TestCase) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function CaseDrawer({
  open,
  onClose,
  existing,
  initialTitle,
  defaultSuiteId,
  suites,
  projectCode,
  history,
  onCreate,
  onSave,
  onDuplicate,
  onDelete,
}: CaseDrawerProps) {
  const isNew = !existing;

  const [tab, setTab] = React.useState("general");
  const [title, setTitle] = React.useState(existing?.title ?? initialTitle ?? "");
  const [suiteId, setSuiteId] = React.useState<string>(existing?.suite_id ?? defaultSuiteId ?? "");
  const [description, setDescription] = React.useState(existing?.description ?? "");
  const [preconditions, setPreconditions] = React.useState(existing?.preconditions ?? "");
  const [reproSteps, setReproSteps] = React.useState(existing?.repro_steps ?? "");
  const [postconditions, setPostconditions] = React.useState(existing?.postconditions ?? BDD_TEMPLATE);
  const [priority, setPriority] = React.useState<string>(existing?.priority ?? "medium");
  const [severity, setSeverity] = React.useState<string>(existing?.severity ?? "normal");
  const [type, setType] = React.useState<string>(existing?.type ?? "functional");
  const [automation, setAutomation] = React.useState<string>(existing?.automation_status ?? "manual");
  const [scriptPath, setScriptPath] = React.useState(existing?.automation_script_path ?? "");
  const [status, setStatus] = React.useState<string>(existing?.status ?? "active");
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const suiteOptions = [
    { value: "", label: "Sem suíte" },
    ...suites.map((s) => ({ value: s.id, label: s.title })),
  ];
  const suiteName = suites.find((s) => s.id === existing?.suite_id)?.title;

  async function handleSubmit() {
    if (!title.trim()) return;
    setSaving(true);
    const payload = {
      title: title.trim(),
      suite_id: suiteId || null,
      description,
      preconditions,
      repro_steps: reproSteps,
      postconditions,
      priority,
      severity,
      type,
      automation_status: automation,
      automation_script_path: automation === "automated" ? scriptPath.trim() || null : null,
      status,
    };
    if (isNew) {
      await onCreate(payload);
    } else {
      await onSave(existing.id, payload);
    }
    setSaving(false);
    onClose();
  }

  const TABS = [
    { key: "general", label: "Geral" },
    { key: "properties", label: "Propriedades" },
    { key: "runs", label: "Execuções" },
    { key: "defects", label: "Defeitos" },
    { key: "history", label: "Histórico" },
  ];

  return (
    <Drawer
      key={existing?.id ?? "new"}
      open={open}
      onClose={onClose}
      width="lg"
      title={
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título do caso de teste"
          autoFocus={isNew}
          className="w-full text-lg font-semibold text-foreground bg-transparent focus:outline-none focus:bg-muted/40 rounded-md px-1 -mx-1"
        />
      }
      subtitle={
        <div className="flex flex-col gap-1">
          {!isNew && (
            <span className="text-xs">
              {projectCode}-{existing.seq}
              {suiteName ? ` · ${suiteName}` : ""}
            </span>
          )}
          {!isNew && (
            <div className="flex items-center gap-2">
              <span>Histórico de execuções:</span>
              <HistoryStrip results={history} />
            </div>
          )}
        </div>
      }
      headerActions={
        !isNew && (
          <>
            <button
              onClick={() => existing && onDuplicate(existing)}
              className="text-muted-foreground hover:text-foreground rounded-md p-1.5"
              title="Duplicar caso"
            >
              <Copy size={16} />
            </button>
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-muted-foreground hover:text-destructive rounded-md p-1.5"
              title="Excluir caso"
            >
              <Trash2 size={16} />
            </button>
          </>
        )
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !title.trim()}>
            {saving ? "Salvando..." : isNew ? "Criar caso" : "Salvar alterações"}
          </Button>
        </>
      }
    >
      <Tabs tabs={TABS} active={tab} onChange={setTab} className="mb-4 -mt-1" />

      {tab === "general" && (
        <div className="flex flex-col gap-5">
          <CollapsibleField
            label="Descrição"
            value={description}
            onChange={setDescription}
            placeholder="Do que se trata este caso de teste"
            emptyLabel="Não preenchido — clique para adicionar uma descrição"
            minHeight="70px"
          />
          <CollapsibleField
            label="Pré-requisitos"
            value={preconditions}
            onChange={setPreconditions}
            placeholder="O que precisa estar pronto antes de rodar este teste"
            emptyLabel="Não preenchido — clique para adicionar pré-requisitos"
            minHeight="60px"
          />
          <CollapsibleField
            label="Passos para reprodução"
            value={reproSteps}
            onChange={setReproSteps}
            placeholder="1. ..."
            emptyLabel="Não preenchido — clique para adicionar os passos"
            minHeight="100px"
          />
          <CollapsibleField
            label="Resultado esperado"
            value={postconditions}
            onChange={setPostconditions}
            placeholder="O que deve acontecer ao final do teste"
            emptyLabel="Não preenchido — clique para adicionar o resultado esperado"
            minHeight="90px"
          />
        </div>
      )}

      {tab === "properties" && (
        <div className="flex flex-col gap-4">
          <Select label="Suíte" value={suiteId} onChange={setSuiteId} options={suiteOptions} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Prioridade" value={priority} onChange={setPriority} options={toSelectOptions(PRIORITY_OPTIONS)} />
            <Select label="Severidade" value={severity} onChange={setSeverity} options={toSelectOptions(SEVERITY_OPTIONS)} />
            <Select label="Tipo" value={type} onChange={setType} options={toSelectOptions(TEST_TYPE_OPTIONS)} />
            <Select
              label="Automação"
              value={automation}
              onChange={setAutomation}
              options={toSelectOptions(AUTOMATION_OPTIONS)}
            />
          </div>
          {automation === "automated" && (
            <ScriptPathField value={scriptPath} onChange={setScriptPath} />
          )}
          <Select
            label="Status"
            value={status}
            onChange={setStatus}
            options={toSelectOptions(CASE_STATUS_OPTIONS as unknown as string[])}
          />
        </div>
      )}

      {tab === "runs" && <RunsTab caseId={existing?.id ?? null} />}
      {tab === "defects" && <DefectsTab caseId={existing?.id ?? null} projectCode={projectCode} />}
      {tab === "history" && <HistoryTab existing={existing} />}

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir caso de teste"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (existing) await onDelete(existing.id);
                setConfirmDelete(false);
                onClose();
              }}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Excluir <strong className="text-foreground">{existing?.title}</strong>? Essa ação não pode ser desfeita.
        </p>
      </Modal>
    </Drawer>
  );
}

interface RunRow {
  status: RunCaseStatus;
  executed_at: string | null;
  test_runs: { title: string; environment: string | null } | { title: string; environment: string | null }[] | null;
}

function RunsTab({ caseId }: { caseId: string | null }) {
  const [rows, setRows] = React.useState<RunRow[] | null>(null);

  React.useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    supabase
      .from("test_run_cases")
      .select("status, executed_at, test_runs(title, environment)")
      .eq("test_case_id", caseId)
      .order("executed_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setRows((data as RunRow[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  if (!caseId) {
    return <EmptyState message="Salve o caso de teste primeiro para ver o histórico de execuções." />;
  }
  if (rows === null) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }
  if (rows.length === 0) {
    return <EmptyState message="Este caso ainda não foi incluído em nenhuma execução." />;
  }

  return (
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
        {rows.map((rc, i) => {
          const run = Array.isArray(rc.test_runs) ? rc.test_runs[0] : rc.test_runs;
          return (
            <TableRow key={i}>
              <TableCell className="font-medium">{run?.title ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{run?.environment ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={statusBadgeVariant(rc.status)}>{statusLabel(rc.status)}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDateTime(rc.executed_at)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

interface DefectRow {
  id: string;
  seq: number;
  title: string;
  severity: string;
  status: string;
}

function DefectsTab({ caseId, projectCode }: { caseId: string | null; projectCode: string }) {
  const [rows, setRows] = React.useState<DefectRow[] | null>(null);

  React.useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    supabase
      .from("defects")
      .select("id, seq, title, severity, status")
      .eq("test_case_id", caseId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setRows((data as DefectRow[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  if (!caseId) {
    return <EmptyState message="Salve o caso de teste primeiro para ver defeitos vinculados." />;
  }
  if (rows === null) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }
  if (rows.length === 0) {
    return <EmptyState message="Nenhum defeito vinculado a este caso." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Título</TableHead>
          <TableHead>Severidade</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((d) => (
          <TableRow key={d.id}>
            <TableCell className="font-mono-table text-xs text-muted-foreground">
              {projectCode}-B{d.seq}
            </TableCell>
            <TableCell className="font-medium">{d.title}</TableCell>
            <TableCell>
              <Badge variant={statusBadgeVariant(d.severity)}>{statusLabel(d.severity)}</Badge>
            </TableCell>
            <TableCell>
              <Badge variant={statusBadgeVariant(d.status)}>{statusLabel(d.status)}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function HistoryTab({ existing }: { existing: TestCase | null }) {
  if (!existing) {
    return <EmptyState message="Salve o caso de teste primeiro para ver o histórico." />;
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">Criado em</p>
        <p className="text-sm font-semibold text-foreground mt-1">{formatDate(existing.created_at)}</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">Última atualização</p>
        <p className="text-sm font-semibold text-foreground mt-1">{formatDate(existing.updated_at)}</p>
      </div>
    </div>
  );
}

export { CaseDrawer };
export type { CaseStatus };
