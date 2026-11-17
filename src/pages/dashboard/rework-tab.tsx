import { StatCard } from "@/pages/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { computeRework } from "@/lib/rework-metrics";
import type { DashboardData } from "@/pages/dashboard/use-dashboard-data";

interface ReworkTabProps {
  data: DashboardData;
  inRange: (iso: string | null) => boolean;
}

/** 1,5 · 2 · — (uma casa decimal só quando precisa). */
function fmt(n: number | null): string {
  return n === null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}
const pctColor = (p: number | null) => (p === null ? undefined : p >= 80 ? "text-emerald-600" : p >= 50 ? "text-amber-600" : "text-red-600");

function ReworkTab({ data, inRange }: ReworkTabProps) {
  const devNames: Record<string, string> = {};
  data.contacts.forEach((c) => (devNames[c.id] = c.name ?? ""));
  const r = computeRework({ runs: data.runs, defects: data.defects, runCases: data.runCases, devNames, inRange });

  if (r.roundsEvaluated === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="mb-1 text-sm font-semibold text-foreground">Nenhuma rodada avaliada no período</h3>
        <p className="text-sm text-muted-foreground">
          Ao concluir uma execução, escolha <strong>Aprovada</strong> ou <strong>Reprovada (devolvida ao dev)</strong> e informe a
          tarefa e o dev responsável. Cada reprovação conta como um retorno pro dev, e é daí que vêm estes números.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Retornos no período"
          value={r.returns}
          colorClassName={r.returns > 0 ? "text-amber-600" : "text-emerald-600"}
          delta={`${r.bugsInReturns} bug(s) nas rodadas reprovadas`}
          info={{
            name: "Retornos no período",
            objective: "Medir quantas vezes uma tarefa voltou do teste para o dev, ou seja, o retrabalho.",
            rule: 'Contagem de execuções avaliadas como "Reprovada (devolvida ao dev)" com a avaliação dentro do período. Cada reprovação conta 1 retorno para o dev responsável daquela execução.',
          }}
        />
        <StatCard
          label="Aprovadas de primeira"
          value={r.firstPassPct === null ? "—" : `${r.firstPassPct}%`}
          colorClassName={pctColor(r.firstPassPct)}
          delta={`${r.firstPassTasks} de ${r.testedTasks} tarefa(s) testada(s) no período`}
          info={{
            name: "Aprovadas de primeira",
            objective: "Ver quantas tarefas passam no teste sem voltar para o dev. Como é uma porcentagem, compara devs com volumes diferentes.",
            rule: '(Tarefas aprovadas já na 1ª rodada ÷ tarefas testadas no período) × 100. Uma tarefa reprovada na 1ª rodada conta contra, mesmo que seja aprovada depois, e conta desde a reprovação, sem esperar a aprovação. A tarefa é identificada pelo campo "Tarefa" da execução; execuções sem Tarefa ficam de fora.',
          }}
        />
        <StatCard
          label="Rodadas até aprovar"
          value={fmt(r.avgRounds)}
          delta={`média das aprovadas (1 = de primeira)${r.inReworkTasks > 0 ? ` · ${r.inReworkTasks} ainda em retrabalho` : ""}`}
          info={{
            name: "Rodadas até aprovar",
            objective: "Entender quantas idas e voltas, em média, uma tarefa precisa até ser aprovada.",
            rule: "Média, entre as tarefas aprovadas no período, do número de rodadas avaliadas até a primeira aprovação (as reprovações antes dela + 1). Só olha as já aprovadas: as que ainda estão em retrabalho aparecem no aviso embaixo do número.",
          }}
        />
        <StatCard
          label="Bugs por retorno"
          value={fmt(r.bugsPerReturn)}
          delta={`${r.bugsInReturns} bug(s) em ${r.returns} retorno(s)`}
          info={{
            name: "Bugs por retorno",
            objective: "Medir o tamanho de cada devolução: quantos bugs, em média, motivam um retorno.",
            rule: "Defeitos vinculados às execuções reprovadas no período ÷ número de retornos no período.",
          }}
        />
      </div>

      {r.roundsWithoutTask > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {r.roundsWithoutTask} rodada(s) avaliada(s) no período sem Tarefa informada: contam nos retornos, mas ficam de fora de
          &quot;Aprovadas de primeira&quot; e &quot;Rodadas até aprovar&quot;.
        </p>
      )}

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Retrabalho por dev</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dev</TableHead>
              <TableHead>Retornos</TableHead>
              <TableHead>Bugs</TableHead>
              <TableHead>Bugs/retorno</TableHead>
              <TableHead>Tarefas testadas</TableHead>
              <TableHead>Aprovadas</TableHead>
              <TableHead>De primeira</TableHead>
              <TableHead>Rodadas até aprovar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.perDev.map((d) => (
              <TableRow key={d.devId ?? "sem-dev"}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className={d.returns > 0 ? "font-medium text-amber-600" : ""}>{d.returns}</TableCell>
                <TableCell>{d.bugs}</TableCell>
                <TableCell>{fmt(d.bugsPerReturn)}</TableCell>
                <TableCell>{d.testedTasks}</TableCell>
                <TableCell>{d.approvedTasks}</TableCell>
                <TableCell className={pctColor(d.firstPassPct)}>{d.firstPassPct === null ? "—" : `${d.firstPassPct}%`}</TableCell>
                <TableCell>{fmt(d.avgRounds)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Tarefas com mais retornos</h3>
        {r.topTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa com retorno no período.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarefa</TableHead>
                <TableHead>Dev</TableHead>
                <TableHead>Retornos</TableHead>
                <TableHead>Bugs</TableHead>
                <TableHead>Rodadas</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.topTasks.map((t) => (
                <TableRow key={t.key}>
                  <TableCell className="font-mono-table text-xs">{t.label}</TableCell>
                  <TableCell>{t.devName}</TableCell>
                  <TableCell className="font-medium text-amber-600">{t.returns}</TableCell>
                  <TableCell>{t.bugs}</TableCell>
                  <TableCell>{t.rounds}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === "approved" ? "success" : "warning"}>{t.status === "approved" ? "Aprovada" : "Em retrabalho"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        O período usa a data da avaliação da rodada. Uma execução sem avaliação (&quot;Não se aplica&quot;) não entra nestes números.
      </p>
    </div>
  );
}

export { ReworkTab };
