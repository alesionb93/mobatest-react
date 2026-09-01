import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { statusBadgeVariant, statusLabel } from "@/lib/labels";
import { formatDuration, profileName } from "@/pages/test-runs/run-helpers";
import type { RunDefect, TestRunCase, Profile } from "@/types/test-runs";

function DefectsTab({ defects, projectCode }: { defects: (RunDefect & { caseTitle?: string })[]; projectCode: string }) {
  if (defects.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <EmptyState message="Nenhum defeito reportado. Defeitos reportados durante esta execução aparecem aqui." />
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Severidade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Caso relacionado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {defects.map((d) => (
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
              <TableCell className="text-muted-foreground">{d.caseTitle ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

interface TeamStat {
  name: string;
  untested: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  pre_existing: number;
  duration: number;
}

function computeTeamStats(runCases: TestRunCase[], profiles: Record<string, Profile>, currentUserId?: string): TeamStat[] {
  const byUser: Record<string, TeamStat> = {};
  runCases.forEach((rc) => {
    const uid = rc.assignee_id || rc.executed_by || "unassigned";
    if (!byUser[uid]) {
      byUser[uid] = {
        name: uid === "unassigned" ? "Não atribuído" : profileName(uid, profiles, currentUserId),
        untested: 0,
        passed: 0,
        failed: 0,
        blocked: 0,
        skipped: 0,
        pre_existing: 0,
        duration: 0,
      };
    }
    const s = rc.status || "untested";
    byUser[uid][s] = (byUser[uid][s] ?? 0) + 1;
    byUser[uid].duration += rc.duration_seconds ?? 0;
  });
  return Object.values(byUser);
}

function TeamTab({ runCases, profiles, currentUserId }: { runCases: TestRunCase[]; profiles: Record<string, Profile>; currentUserId?: string }) {
  const rows = computeTeamStats(runCases, profiles, currentUserId);
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Duração</TableHead>
              <TableHead>Não testados</TableHead>
              <TableHead>Passou</TableHead>
              <TableHead>Falhou</TableHead>
              <TableHead>Bloqueado</TableHead>
              <TableHead>Pulado</TableHead>
              <TableHead>Pré-existente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.name}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="font-mono-table text-xs text-muted-foreground">{formatDuration(r.duration)}</TableCell>
                <TableCell>{r.untested || 0}</TableCell>
                <TableCell className="text-emerald-600 font-medium">{r.passed || 0}</TableCell>
                <TableCell className="text-red-600 font-medium">{r.failed || 0}</TableCell>
                <TableCell className="text-amber-600 font-medium">{r.blocked || 0}</TableCell>
                <TableCell className="text-muted-foreground">{r.skipped || 0}</TableCell>
                <TableCell className="text-violet-600 font-medium">{r.pre_existing || 0}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Observação: o Veiser Test usa "Pré-existente" no lugar de "Retest"/"Invalid" do Qase — são os status
        disponíveis neste app.
      </p>
    </div>
  );
}

export { DefectsTab, TeamTab };
