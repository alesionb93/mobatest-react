import * as React from "react";
import { toast } from "sonner";
import { UserPlus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useProject } from "@/contexts/project-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { timeAgo, initials } from "@/lib/format";

interface ProfileInfo {
  full_name: string | null;
  email: string | null;
  last_seen_at: string | null;
}
interface MemberRow {
  user_id: string;
  role: "owner" | "admin" | "member";
  is_active: boolean;
  created_at: string;
  profiles: ProfileInfo | ProfileInfo[] | null;
}

function TeamPage() {
  const { user } = useAuth();
  const { activeProject, reload: reloadProjects } = useProject();
  const [members, setMembers] = React.useState<MemberRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!activeProject) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("project_members")
      .select("user_id, role, is_active, created_at, profiles(full_name, email, last_seen_at)")
      .eq("project_id", activeProject.id)
      .order("created_at");
    if (error) toast.error("Não foi possível carregar a equipe: " + error.message);
    setMembers((data as MemberRow[]) ?? []);
    setLoading(false);
  }, [activeProject]);

  React.useEffect(() => {
    load();
  }, [load]);

  function profile(m: MemberRow): ProfileInfo | null {
    return Array.isArray(m.profiles) ? m.profiles[0] ?? null : m.profiles;
  }

  async function handleToggleActive(m: MemberRow, checked: boolean) {
    const { error } = await supabase
      .from("project_members")
      .update({ is_active: checked })
      .eq("project_id", activeProject!.id)
      .eq("user_id", m.user_id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(checked ? "Membro reativado." : "Membro desativado — perdeu o acesso ao projeto.");
    await load();
  }

  async function handleRoleChange(m: MemberRow, role: string) {
    const { error } = await supabase
      .from("project_members")
      .update({ role })
      .eq("project_id", activeProject!.id)
      .eq("user_id", m.user_id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Papel atualizado.");
    await load();
  }

  async function handleRemove(userId: string) {
    const { error } = await supabase
      .from("project_members")
      .delete()
      .eq("project_id", activeProject!.id)
      .eq("user_id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Membro removido.");
    setConfirmRemoveId(null);
    await load();
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {members.length} membro(s) em {activeProject?.name}
        </p>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus size={14} /> Convidar membro
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Última ação</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const p = profile(m);
              const isOwner = m.role === "owner";
              const name = p?.full_name || "Sem nome";
              return (
                <TableRow key={m.user_id}>
                  <TableCell>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
                      {initials(name)}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {name} {m.user_id === user?.id && <span className="text-muted-foreground font-normal">(você)</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p?.email ?? "—"}</TableCell>
                  <TableCell>
                    {isOwner ? (
                      <Badge variant="success">Ativo</Badge>
                    ) : (
                      <Switch checked={m.is_active} onCheckedChange={(v) => handleToggleActive(m, v)} aria-label="Ativo" />
                    )}
                  </TableCell>
                  <TableCell>
                    {isOwner ? (
                      <Badge variant="info">Dono</Badge>
                    ) : (
                      <Select
                        value={m.role}
                        onChange={(v) => handleRoleChange(m, v)}
                        options={[
                          { value: "member", label: "Membro" },
                          { value: "admin", label: "Admin" },
                        ]}
                        className="w-32"
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{timeAgo(p?.last_seen_at)}</TableCell>
                  <TableCell>
                    {!isOwner && (
                      <button
                        onClick={() => setConfirmRemoveId(m.user_id)}
                        className="text-muted-foreground hover:text-destructive rounded p-1"
                        title="Remover"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <InviteMemberModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={async () => {
          await load();
          await reloadProjects();
        }}
      />

      <Modal
        open={confirmRemoveId !== null}
        onClose={() => setConfirmRemoveId(null)}
        title="Remover membro"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRemoveId(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => confirmRemoveId && handleRemove(confirmRemoveId)}>
              Remover
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">Remover este membro do projeto? Ele perde o acesso imediatamente.</p>
      </Modal>
    </div>
  );
}

function InviteMemberModal({ open, onClose, onInvited }: { open: boolean; onClose: () => void; onInvited: () => void }) {
  const { activeProject } = useProject();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("member");
  const [feedback, setFeedback] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setEmail("");
      setRole("member");
      setFeedback(null);
    }
  }, [open]);

  async function handleInvite() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      toast.error("Digite um e-mail.");
      return;
    }
    setSaving(true);
    setFeedback(null);
    const { data: found, error: findError } = await supabase.rpc("find_user_by_email", { p_email: trimmed });
    if (findError) {
      setSaving(false);
      toast.error(findError.message);
      return;
    }
    const foundUser = Array.isArray(found) ? found[0] : found;
    if (!foundUser) {
      setSaving(false);
      setFeedback(
        "Nenhuma conta encontrada com esse e-mail. Peça pra pessoa criar uma conta no Mobatest primeiro — depois é só convidar de novo."
      );
      return;
    }
    const { error: insertError } = await supabase
      .from("project_members")
      .insert({ project_id: activeProject!.id, user_id: foundUser.id, role });
    setSaving(false);
    if (insertError) {
      toast.error(insertError.message.includes("duplicate") ? "Essa pessoa já é membro deste projeto." : insertError.message);
      return;
    }
    toast.success(`${foundUser.full_name || "Pessoa"} adicionada à equipe!`);
    onClose();
    onInvited();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Convidar membro"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleInvite} disabled={saving}>
            {saving ? "Buscando..." : "Convidar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pessoa@empresa.com"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">A pessoa precisa já ter uma conta no Mobatest com esse e-mail.</p>
        </div>
        <Select
          label="Papel"
          value={role}
          onChange={setRole}
          options={[
            { value: "member", label: "Membro" },
            { value: "admin", label: "Admin" },
          ]}
        />
        {feedback && <p className="text-xs text-muted-foreground">{feedback}</p>}
      </div>
    </Modal>
  );
}

export { TeamPage };
