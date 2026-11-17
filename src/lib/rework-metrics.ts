import { taskKey, taskLabel } from "@/lib/run-review";
import type { RunReviewOutcome } from "@/types/test-runs";

/**
 * Retrabalho por dev: quantas vezes uma tarefa voltou do teste pro dev.
 *
 * Uma "rodada" é uma execução avaliada (aprovada ou reprovada). Uma tarefa tem uma ou mais rodadas (as execuções com a
 * mesma Tarefa, ver taskKey). O retorno é a rodada REPROVADA, atribuída ao dev daquela execução.
 *
 * "De primeira": das tarefas TESTADAS no período (as que tiveram a primeira rodada avaliada nele), quantas foram aprovadas
 * logo nessa primeira rodada. Uma tarefa reprovada na primeira rodada conta contra, mesmo que seja aprovada depois, e
 * conta desde já, sem esperar a aprovação. Medir só sobre as aprovadas esconderia as que ainda estão em retrabalho.
 *
 * Datas: o período filtra pela data da avaliação (`reviewed_at`).
 */

export interface ReworkRun {
  id: string;
  task_ref: string | null;
  dev_contact_id: string | null;
  review_outcome: RunReviewOutcome | null;
  reviewed_at: string | null;
  completed_at: string | null;
  created_at: string;
}
export interface ReworkDefect {
  test_run_case_id: string | null;
}
export interface ReworkRunCase {
  id: string;
  test_run_id: string;
}
export interface ReworkInput {
  runs: ReworkRun[];
  defects: ReworkDefect[];
  runCases: ReworkRunCase[];
  /** id do contato -> nome */
  devNames: Record<string, string>;
  inRange: (iso: string | null) => boolean;
}

export interface DevRework {
  devId: string | null;
  name: string;
  returns: number;
  bugs: number;
  bugsPerReturn: number | null;
  /** tarefas cuja primeira rodada foi avaliada no período (a primeira rodada é atribuída a este dev) */
  testedTasks: number;
  approvedTasks: number;
  firstPassTasks: number;
  firstPassPct: number | null;
  avgRounds: number | null;
}
export interface TaskRework {
  key: string;
  label: string;
  devName: string;
  /** retornos no período */
  returns: number;
  /** defeitos das rodadas reprovadas no período */
  bugs: number;
  /** rodadas avaliadas da tarefa, no total */
  rounds: number;
  status: "approved" | "rework";
}
export interface ReworkResult {
  returns: number;
  bugsInReturns: number;
  bugsPerReturn: number | null;
  /** tarefas testadas no período: as que tiveram a primeira rodada avaliada nele */
  testedTasks: number;
  /** tarefas aprovadas no período (a data da primeira aprovação) */
  approvedTasks: number;
  /** das testadas, as aprovadas já na primeira rodada */
  firstPassTasks: number;
  firstPassPct: number | null;
  /** média de rodadas das tarefas aprovadas no período */
  avgRounds: number | null;
  /** tarefas com rodada no período que ainda não foram aprovadas */
  inReworkTasks: number;
  /** rodadas avaliadas no período */
  roundsEvaluated: number;
  /** rodadas avaliadas no período que não informaram a Tarefa (ficam de fora das métricas por tarefa) */
  roundsWithoutTask: number;
  perDev: DevRework[];
  topTasks: TaskRework[];
}

interface Round {
  run: ReworkRun;
  when: string;
  outcome: RunReviewOutcome;
  bugs: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);
const ratio = (part: number, whole: number) => (whole > 0 ? round1(part / whole) : null);

interface TaskOutcome {
  approvedAt: string;
  approvedDev: string | null;
  roundsUntilApproval: number;
}

/** Até a primeira aprovação da tarefa: em que rodada ela veio. */
function approvalOf(rounds: Round[]): TaskOutcome | null {
  const index = rounds.findIndex((r) => r.outcome === "approved");
  if (index < 0) return null;
  return {
    approvedAt: rounds[index].when,
    approvedDev: rounds[index].run.dev_contact_id,
    roundsUntilApproval: index + 1,
  };
}

function bugsPerRun(defects: ReworkDefect[], runCases: ReworkRunCase[]): Map<string, number> {
  const runOfCase = new Map(runCases.map((rc) => [rc.id, rc.test_run_id]));
  const bugs = new Map<string, number>();
  for (const d of defects) {
    const runId = d.test_run_case_id ? runOfCase.get(d.test_run_case_id) : undefined;
    if (runId) bugs.set(runId, (bugs.get(runId) ?? 0) + 1);
  }
  return bugs;
}

function devName(id: string | null, names: Record<string, string>): string {
  if (!id) return "Sem dev atribuído";
  return names[id] || "Dev removido";
}

export function computeRework(input: ReworkInput): ReworkResult {
  const bugs = bugsPerRun(input.defects, input.runCases);
  const rounds: Round[] = input.runs
    .filter((r): r is ReworkRun & { review_outcome: RunReviewOutcome } => r.review_outcome !== null)
    .map((run) => ({ run, when: run.reviewed_at ?? run.completed_at ?? run.created_at, outcome: run.review_outcome, bugs: bugs.get(run.id) ?? 0 }))
    .sort((a, b) => a.when.localeCompare(b.when) || a.run.created_at.localeCompare(b.run.created_at) || a.run.id.localeCompare(b.run.id));

  const inPeriod = rounds.filter((r) => input.inRange(r.when));
  const returnRounds = inPeriod.filter((r) => r.outcome === "rejected");

  // Por tarefa, com TODAS as rodadas (a ordem delas decide se foi de primeira), e depois recorta pelo período.
  const byTask = new Map<string, Round[]>();
  for (const r of rounds) {
    const key = taskKey(r.run.task_ref);
    if (key) byTask.set(key, [...(byTask.get(key) ?? []), r]);
  }
  const approvals = new Map<string, TaskOutcome>();
  for (const [key, taskRounds] of byTask) {
    const outcome = approvalOf(taskRounds);
    if (outcome && input.inRange(outcome.approvedAt)) approvals.set(key, outcome);
  }
  // Tarefas testadas no período: a primeira rodada caiu nele. Dessas, as aprovadas logo na primeira são "de primeira".
  const firstRounds = [...byTask.values()].map((taskRounds) => taskRounds[0]).filter((first) => input.inRange(first.when));
  const firstPass = firstRounds.filter((first) => first.outcome === "approved");
  const inRework = [...byTask.values()].filter((taskRounds) => taskRounds.some((r) => input.inRange(r.when)) && !taskRounds.some((r) => r.outcome === "approved"));

  const devs = new Map<string | null, DevRework>();
  const row = (id: string | null) => {
    if (!devs.has(id)) {
      devs.set(id, { devId: id, name: devName(id, input.devNames), returns: 0, bugs: 0, bugsPerReturn: null, testedTasks: 0, approvedTasks: 0, firstPassTasks: 0, firstPassPct: null, avgRounds: null });
    }
    return devs.get(id)!;
  };
  const roundsSum = new Map<string | null, number>();
  for (const r of returnRounds) {
    const d = row(r.run.dev_contact_id);
    d.returns += 1;
    d.bugs += r.bugs;
  }
  for (const first of firstRounds) {
    const d = row(first.run.dev_contact_id);
    d.testedTasks += 1;
    if (first.outcome === "approved") d.firstPassTasks += 1;
  }
  for (const outcome of approvals.values()) {
    const d = row(outcome.approvedDev);
    d.approvedTasks += 1;
    roundsSum.set(outcome.approvedDev, (roundsSum.get(outcome.approvedDev) ?? 0) + outcome.roundsUntilApproval);
  }
  const perDev = [...devs.values()]
    .map((d) => ({
      ...d,
      bugsPerReturn: ratio(d.bugs, d.returns),
      firstPassPct: pct(d.firstPassTasks, d.testedTasks),
      avgRounds: ratio(roundsSum.get(d.devId) ?? 0, d.approvedTasks),
    }))
    .sort((a, b) => b.returns - a.returns || b.approvedTasks - a.approvedTasks || a.name.localeCompare(b.name));

  const topTasks: TaskRework[] = [];
  for (const [key, taskRounds] of byTask) {
    const rejectedInPeriod = taskRounds.filter((r) => r.outcome === "rejected" && input.inRange(r.when));
    if (rejectedInPeriod.length === 0) continue;
    const last = taskRounds[taskRounds.length - 1];
    topTasks.push({
      key,
      label: taskLabel(last.run.task_ref),
      devName: devName(last.run.dev_contact_id, input.devNames),
      returns: rejectedInPeriod.length,
      bugs: rejectedInPeriod.reduce((sum, r) => sum + r.bugs, 0),
      rounds: taskRounds.length,
      status: taskRounds.some((r) => r.outcome === "approved") ? "approved" : "rework",
    });
  }
  topTasks.sort((a, b) => b.returns - a.returns || b.bugs - a.bugs || a.label.localeCompare(b.label));

  const approved = [...approvals.values()];
  const bugsInReturns = returnRounds.reduce((sum, r) => sum + r.bugs, 0);
  return {
    returns: returnRounds.length,
    bugsInReturns,
    bugsPerReturn: ratio(bugsInReturns, returnRounds.length),
    testedTasks: firstRounds.length,
    approvedTasks: approved.length,
    firstPassTasks: firstPass.length,
    firstPassPct: pct(firstPass.length, firstRounds.length),
    avgRounds: ratio(approved.reduce((sum, a) => sum + a.roundsUntilApproval, 0), approved.length),
    inReworkTasks: inRework.length,
    roundsEvaluated: inPeriod.length,
    roundsWithoutTask: inPeriod.filter((r) => !taskKey(r.run.task_ref)).length,
    perDev,
    topTasks: topTasks.slice(0, 8),
  };
}
