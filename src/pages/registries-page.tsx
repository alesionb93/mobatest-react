import * as React from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Skeleton, EmptyState } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface ReasonRow {
  id: string;
  label: string;
  is_active: boolean;
}
interface ContactRow {
  id: string;
  name: string;
  email: string | null;
  kind: "dev" | "po";
  is_active: boolean;
}

const TABS = [
  { key: "reasons", label: "Motivos de falha" },
  { key: "cancellation", label: "Motivos de cancelamento" },
  { key: "contacts", label: "Contatos (Dev/PO)" },
];

function RegistriesPage() {
  const { user } = useAuth();
  const [tab, setTab] = React.useState("reasons");
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loadingAdmin, setLoadingAdmin] = React.useState(true);

  React.useEffect(() => {
    if (!user) return;
    supabase
      .from("project_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(({ data }) => {
        setIsAdmin((data ?? []).some((m) => m.role === "owner" || m.role === "admin"));
        setLoadingAdmin(false);
      });
  }, [user]);

  if (loadingAdmin) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {!isAdmin && (
        <p className="text-xs text-muted-foreground">
          Você pode ver estas listas, mas só um Admin ou Dono de projeto pode editá-las.
        </p>
      )}
      {tab === "reasons" && (
        <ReasonListTab table="failure_reasons" placeholder="Novo motivo de falha..." isAdmin={isAdmin} />
      )}
      {tab === "cancellation" && (
        <ReasonListTab table="cancellation_reasons" placeholder="Novo motivo de cancelamento..." isAdmin={isAdmin} />
      )}
      {tab === "contacts" && <ContactsTab isAdmin={isAdmin} />}
    </div>
  );
}

function ReasonListTab({ table, placeholder, isAdmin }: { table: string; placeholder: string; isAdmin: boolean }) {
  const [rows, setRows] = React.useState<ReasonRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newLabel, setNewLabel] = React.useState("");
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from(table).select("*").order("label");
    setRows((data as ReasonRow[]) ?? []);
    setLoading(false);
  }, [table]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleAdd() {
    const label = newLabel.trim();
    if (!label) {
      toast.error("Digite um motivo.");
      return;
    }
    const { error } = await supabase.from(table).insert({ label });
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Esse motivo já existe." : error.message);
      return;
    }
    toast.success("Motivo adicionado!");
    setNewLabel("");
    await load();
  }

  async function handleToggle(row: ReasonRow) {
    const { error } = await supabase.from(table).update({ is_active: !row.is_active }).eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir — provavelmente já está em uso. Desative em vez de excluir.");
      setConfirmDeleteId(null);
      return;
    }
    toast.success("Motivo excluído.");
    setConfirmDeleteId(null);
    await load();
  }

  if (loading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="flex flex-col gap-3">
      {isAdmin && (
        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={placeholder}
            className="flex-1"
          />
          <Button onClick={handleAdd}>Adicionar</Button>
        </div>
      )}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState message="Nenhum motivo cadastrado." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Motivo</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-32" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell>
                    <Switch checked={r.is_active} onCheckedChange={() => handleToggle(r)} aria-label="Ativo" />
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <button
                        onClick={() => setConfirmDeleteId(r.id)}
                        className="text-muted-foreground hover:text-destructive rounded p-1"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Modal
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        title="Excluir motivo"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}>
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Excluir este motivo? Se ele já estiver em uso, a exclusão será bloqueada — desative-o em vez disso.
        </p>
      </Modal>
    </div>
  );
}

function ContactsTab({ isAdmin }: { isAdmin: boolean }) {
  const [rows, setRows] = React.useState<ContactRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [kind, setKind] = React.useState("dev");
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("contacts").select("*").order("name");
    setRows((data as ContactRow[]) ?? []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleToggle(row: ContactRow) {
    const { error } = await supabase.from("contacts").update({ is_active: !row.is_active }).eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) {
      toast.error("Não foi possível excluir — provavelmente já está em uso em algum defeito. Desative em vez de excluir.");
      setConfirmDeleteId(null);
      return;
    }
    toast.success("Contato excluído.");
    setConfirmDeleteId(null);
    await load();
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Dê um nome ao contato.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("contacts").insert({ name: name.trim(), email: email.trim() || null, kind });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Contato cadastrado!");
    setModalOpen(false);
    setName("");
    setEmail("");
    setKind("dev");
    await load();
  }

  if (loading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="flex flex-col gap-3">
      {isAdmin && (
        <Button className="self-start" onClick={() => setModalOpen(true)}>
          <Plus size={14} /> Novo contato
        </Button>
      )}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState message="Nenhum contato cadastrado. Cadastre devs e POs pra poder atribuí-los como responsáveis num defeito." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-32" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                  <TableCell>
                    <span className="text-xs rounded-full border border-blue-200 bg-blue-50 text-blue-700 px-2 py-0.5">
                      {c.kind === "dev" ? "Dev" : "PO"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Switch checked={c.is_active} onCheckedChange={() => handleToggle(c)} aria-label="Ativo" />
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <button
                        onClick={() => setConfirmDeleteId(c.id)}
                        className="text-muted-foreground hover:text-destructive rounded p-1"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novo contato"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: João Silva" autoFocus />
          <Input
            label="E-mail (opcional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="joao@empresa.com"
          />
          <Select
            label="Tipo"
            value={kind}
            onChange={setKind}
            options={[
              { value: "dev", label: "Dev" },
              { value: "po", label: "PO" },
            ]}
          />
        </div>
      </Modal>

      <Modal
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        title="Excluir contato"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}>
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Excluir este contato? Se ele já estiver vinculado a um defeito, a exclusão será bloqueada.
        </p>
      </Modal>
    </div>
  );
}

export { RegistriesPage };
