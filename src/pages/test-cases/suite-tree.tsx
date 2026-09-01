import * as React from "react";
import { ChevronRight, Folder, MoreHorizontal, Pencil, FolderPlus, Trash2, Plus, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TestSuite } from "@/types/test-cases";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const WIDTH_STORAGE_KEY = "veiser-test:suite-tree-width";
const MIN_WIDTH = 220;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 300;

interface SuiteTreeProps {
  suites: TestSuite[];
  casesCountBySuite: Record<string, number>;
  totalCasesCount: number;
  selectedSuiteId: string | "all";
  onSelectSuite: (id: string | "all") => void;
  onCreateSuite: (title: string, parentSuiteId: string | null) => void;
  onRenameSuite: (id: string, title: string) => void;
  onMoveSuite: (id: string, parentSuiteId: string | null) => void;
  onDeleteSuite: (id: string) => void;
}

function SuiteTree({
  suites,
  casesCountBySuite,
  totalCasesCount,
  selectedSuiteId,
  onSelectSuite,
  onCreateSuite,
  onRenameSuite,
  onMoveSuite,
  onDeleteSuite,
}: SuiteTreeProps) {
  const [width, setWidth] = React.useState(() => {
    const saved = parseInt(localStorage.getItem(WIDTH_STORAGE_KEY) ?? "", 10);
    return saved >= MIN_WIDTH && saved <= MAX_WIDTH ? saved : DEFAULT_WIDTH;
  });
  const [collapsedIds, setCollapsedIds] = React.useState<Set<string>>(new Set());
  const [dialog, setDialog] = React.useState<
    | { mode: "create"; parentSuiteId: string | null }
    | { mode: "rename"; suite: TestSuite }
    | null
  >(null);
  const [dialogValue, setDialogValue] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<TestSuite | null>(null);
  const resizing = React.useRef(false);
  const widthRef = React.useRef(width);
  widthRef.current = width;

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    resizing.current = true;
    const startX = e.clientX;
    const startWidth = widthRef.current;
    document.body.style.cursor = "col-resize";
    function onMove(ev: MouseEvent) {
      if (!resizing.current) return;
      const delta = ev.clientX - startX;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
      setWidth(next);
    }
    function onUp() {
      resizing.current = false;
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      localStorage.setItem(WIDTH_STORAGE_KEY, String(widthRef.current));
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function toggleCollapsed(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const byParent = React.useMemo(() => {
    const map: Record<string, TestSuite[]> = {};
    suites.forEach((s) => {
      const key = s.parent_suite_id ?? "root";
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [suites]);

  function openDialogValue(initial: string) {
    setDialogValue(initial);
  }

  function submitDialog() {
    const title = dialogValue.trim();
    if (!title) return;
    if (dialog?.mode === "create") {
      onCreateSuite(title, dialog.parentSuiteId);
    } else if (dialog?.mode === "rename") {
      onRenameSuite(dialog.suite.id, title);
    }
    setDialog(null);
  }

  function renderRow(suite: TestSuite, depth: number) {
    const children = byParent[suite.id] ?? [];
    const hasChildren = children.length > 0;
    const collapsed = collapsedIds.has(suite.id);
    const count = casesCountBySuite[suite.id] ?? 0;

    return (
      <div key={suite.id}>
        <div
          draggable
          onDragStart={(e) => e.dataTransfer.setData("text/suite-id", suite.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData("text/suite-id");
            if (draggedId && draggedId !== suite.id) onMoveSuite(draggedId, suite.id);
          }}
          onClick={() => onSelectSuite(suite.id)}
          className={cn(
            "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer",
            selectedSuiteId === suite.id ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/60"
          )}
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapsed(suite.id);
              }}
              className="shrink-0 text-muted-foreground"
            >
              <ChevronRight size={14} className={cn("transition-transform", !collapsed && "rotate-90")} />
            </button>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <Folder size={14} className="shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate" title={suite.title}>
            {suite.title}
          </span>
          <span className="text-xs text-muted-foreground">{count}</span>
          <DropdownMenu
            trigger={
              <button className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground hover:text-foreground">
                <MoreHorizontal size={14} />
              </button>
            }
            items={[
              {
                label: "Renomear",
                icon: <Pencil size={14} />,
                onSelect: () => {
                  setDialog({ mode: "rename", suite });
                  openDialogValue(suite.title);
                },
              },
              {
                label: "Nova sub-suíte",
                icon: <FolderPlus size={14} />,
                onSelect: () => {
                  setDialog({ mode: "create", parentSuiteId: suite.id });
                  openDialogValue("");
                },
              },
              {
                label: "Excluir",
                icon: <Trash2 size={14} />,
                danger: true,
                onSelect: () => setDeleteTarget(suite),
              },
            ]}
          />
        </div>
        {hasChildren && !collapsed && children.map((child) => renderRow(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="relative flex shrink-0" style={{ width }}>
      <div className="flex-1 flex flex-col gap-1 pr-2 overflow-y-auto">
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="text-xs font-medium text-muted-foreground">Suítes</span>
          <button
            onClick={() => {
              setDialog({ mode: "create", parentSuiteId: null });
              openDialogValue("");
            }}
            className="text-muted-foreground hover:text-foreground rounded p-0.5"
            title="Nova suíte"
          >
            <Plus size={14} />
          </button>
        </div>
        <div
          onClick={() => onSelectSuite("all")}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData("text/suite-id");
            if (draggedId) onMoveSuite(draggedId, null);
          }}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer",
            selectedSuiteId === "all" ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/60"
          )}
        >
          <span className="w-3.5" />
          <Folder size={14} className="text-muted-foreground" />
          <span className="flex-1">Todos os casos</span>
          <span className="text-xs text-muted-foreground">{totalCasesCount}</span>
        </div>
        {(byParent["root"] ?? []).map((s) => renderRow(s, 0))}
      </div>

      <div
        onMouseDown={startResize}
        className="group relative w-2.5 shrink-0 cursor-col-resize flex items-center justify-center"
      >
        <div className="h-full w-px bg-border group-hover:bg-ring transition-colors" />
        <div className="absolute flex h-8 w-3.5 items-center justify-center rounded-sm border border-border bg-card text-muted-foreground group-hover:border-ring group-hover:text-foreground">
          <GripVertical size={11} />
        </div>
      </div>

      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog?.mode === "rename" ? "Renomear suíte" : "Nova suíte"}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={submitDialog}>Salvar</Button>
          </>
        }
      >
        <Input
          label="Nome da suíte"
          autoFocus
          value={dialogValue}
          onChange={(e) => setDialogValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitDialog()}
          placeholder="Ex: Login e cadastro"
        />
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Excluir suíte"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleteTarget) onDeleteSuite(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Excluir <strong className="text-foreground">{deleteTarget?.title}</strong>? Os casos desta suíte não
          serão apagados, mas ficarão sem suíte. Sub-suítes também serão excluídas.
        </p>
      </Modal>
    </div>
  );
}

export { SuiteTree };
