import { taskKey } from "@/lib/run-review";

/**
 * "Executar novamente": uma execução reprovada volta pro dev, e quando ele devolve, o QA roda uma NOVA execução da mesma
 * tarefa. Cada uma é uma rodada. Aqui ficam as regras de como a nova nasce a partir da anterior.
 */

/** " – rodada 2" no fim do título (aceita o travessão ou o hífen). */
const ROUND_SUFFIX = /\s+[–-]\s+rodada\s+(\d+)\s*$/i;

/** O título sem o sufixo de rodada: "Login – rodada 3" vira "Login". */
export function baseTitle(title: string): string {
  return title.replace(ROUND_SUFFIX, "").trim();
}

/** Em que rodada o título diz que está (sem sufixo = a primeira). */
export function roundNumberOf(title: string): number {
  const match = ROUND_SUFFIX.exec(title);
  return match ? Number(match[1]) : 1;
}

export interface RoundRun {
  title: string;
  task_ref: string | null;
}

/**
 * O número da próxima rodada. Com tarefa: depois da maior rodada já feita dessa tarefa (olha as execuções com a mesma
 * tarefa e também o sufixo dos títulos, então continua certo se uma rodada do meio foi excluída). Sem tarefa não dá pra
 * agrupar, então segue só o título da execução de origem.
 */
export function nextRoundNumber(current: RoundRun, all: RoundRun[]): number {
  const key = taskKey(current.task_ref);
  if (!key) return roundNumberOf(current.title) + 1;
  const same = all.filter((r) => taskKey(r.task_ref) === key);
  const highest = Math.max(roundNumberOf(current.title), ...same.map((r) => roundNumberOf(r.title)));
  return Math.max(same.length, highest) + 1;
}

export function nextRoundTitle(title: string, round: number): string {
  return `${baseTitle(title)} – rodada ${round}`;
}

/**
 * Os casos que já vêm marcados na nova rodada: os que ainda precisam de uma resposta (falharam, ficaram bloqueados,
 * foram pulados ou nunca foram testados). Passou e Pré-existente não: o primeiro já está ok, e o segundo é um problema
 * que já existia antes da tarefa, então não é o dev que vai corrigir.
 */
const NEED_RETEST = new Set(["failed", "blocked", "skipped", "untested"]);
export function defaultRerunCaseIds(runCases: { id: string; status: string | null }[]): string[] {
  return runCases.filter((rc) => NEED_RETEST.has(rc.status || "untested")).map((rc) => rc.id);
}
