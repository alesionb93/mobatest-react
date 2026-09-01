import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/contexts/project-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { statusLabel } from "@/lib/labels";

function ProjectsPage() {
  const navigate = useNavigate();
  const { projects, loading, setActiveProjectId, createProject } = useProject();
  const [createOpen, setCreateOpen] = React.useState(false);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  function goToProject(id: string) {
    setActiveProjectId(id);
    navigate("/");
  }

  async function handleExport(projectId: string, projectCode: string) {
    toast.info("Preparando backup... isso pode levar alguns segundos.");
    const [suitesRes, casesRes, plansRes, runsRes, defectsRes] = await Promise.all([
      supabase.from("test_suites").select("*").eq("project_id", projectId),
      supabase.from("test_cases").select("*").eq("project_id", projectId),
      supabase.from("test_plans").select("*").eq("project_id", projectId),
      supabase.from("test_runs").select("*").eq("project_id", projectId),
      supabase.from("defects").select("*").eq("project_id", projectId),
    ]);

    const planIds = (plansRes.data ?? []).map((p) => p.id);
    const planCasesRes = planIds.length
      ? await supabase.from("test_plan_cases").select("*").in("test_plan_id", planIds)
      : { data: [] };

    const runIds = new Set((runsRes.data ?? []).map((r) => r.id));
    const runCasesRes = runIds.size ? await supabase.from("test_run_cases").select("*") : { data: [] };

    const defectIds = new Set((defectsRes.data ?? []).map((d) => d.id));
    const commentsRes = defectIds.size ? await supabase.from("defect_comments").select("*") : { data: [] };

    const backup = {
      exported_at: new Date().toISOString(),
      test_suites: suitesRes.data ?? [],
      test_cases: casesRes.data ?? [],
      test_plans: plansRes.data ?? [],
      test_plan_cases: planCasesRes.data ?? [],
      test_runs: runsRes.data ?? [],
      test_run_cases: (runCasesRes.data ?? []).filter((rc) => runIds.has(rc.test_run_id)),
      defects: defectsRes.data ?? [],
      defect_comments: (commentsRes.data ?? []).filter((c) => defectIds.has(c.defect_id)),
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectCode}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Backup baixado!");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{projects.length} projeto(s)</p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Novo projeto
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Meu papel</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p) => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => goToProject(p.id)}>
                <TableCell className="font-mono-table text-xs text-muted-foreground">{p.code}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  <Badge variant="info">{statusLabel(p.role)}</Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button variant="secondary" size="sm" onClick={() => handleExport(p.id, p.code)} title="Baixar backup completo (JSON)">
                    <Download size={13} /> Exportar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} createProject={createProject} onCreated={() => navigate("/")} />
    </div>
  );
}

function CreateProjectModal({
  open,
  onClose,
  createProject,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  createProject: (input: { name: string; code: string; description: string }) => Promise<string | null>;
  onCreated: () => void;
}) {
  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setDescription("");
    }
  }, [open]);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Dê um nome ao projeto.");
      return;
    }
    setSaving(true);
    const id = await createProject({ name: name.trim(), code: code.trim().toUpperCase() || "PRJ", description: description.trim() });
    setSaving(false);
    if (!id) {
      toast.error("Erro ao criar projeto.");
      return;
    }
    toast.success("Projeto criado com sucesso!");
    onClose();
    onCreated();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Novo projeto"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Criando..." : "Criar projeto"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Nome do projeto" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: App Mobile Banking" autoFocus />
        <div className="flex flex-col gap-1">
          <Input
            label="Código (prefixo curto)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Ex: MB"
            maxLength={8}
          />
          <p className="text-xs text-muted-foreground">Usado como prefixo visual dos IDs (não afeta a funcionalidade).</p>
        </div>
        <Textarea
          label="Descrição (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Do que se trata este projeto?"
        />
      </div>
    </Modal>
  );
}

export { ProjectsPage };
