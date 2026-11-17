import { statusBadgeVariant, statusLabel } from "@/lib/labels";
import type { BadgeProps } from "@/components/ui/badge";
import type { RunReviewOutcome } from "@/types/test-runs";

/**
 * A avaliação de uma rodada de teste: no fim da execução, o QA diz se a tarefa foi aprovada ou reprovada e devolvida ao
 * dev. Uma reprovação conta como UM retorno pro dev responsável (o retrabalho).
 */

/** Chave de card do Jira (ex: MOB-11270), em qualquer lugar do texto. */
const JIRA_KEY = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/i;

export const OUTCOME_LABEL: Record<RunReviewOutcome, string> = {
  approved: "Aprovada",
  rejected: "Reprovada (devolvida ao dev)",
};

/** O texto da tarefa como será gravado: sem espaços sobrando; vazio vira null. */
export function cleanTaskRef(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim().replace(/\s+/g, " ");
  return value === "" ? null : value;
}

/**
 * A identidade da tarefa, pra agrupar as rodadas dela. O campo é livre, então: se houver uma chave do Jira no texto
 * ("mob-11270" ou "MOB-11270 ajustar tela"), é ela; senão, o texto sem diferença de maiúscula e minúscula.
 */
export function taskKey(ref: string | null | undefined): string | null {
  const value = cleanTaskRef(ref);
  if (!value) return null;
  return (JIRA_KEY.exec(value)?.[0] ?? value).toUpperCase();
}

/** O que aparece na tela pra tarefa: a chave do Jira, se houver, senão o texto como foi digitado. */
export function taskLabel(ref: string | null | undefined): string {
  const value = cleanTaskRef(ref);
  if (!value) return "";
  return JIRA_KEY.exec(value)?.[0].toUpperCase() ?? value;
}

export interface ReviewInput {
  outcome: RunReviewOutcome | null;
  devId: string | null;
  taskRef: string | null;
}

export interface ReviewPrevious {
  review_outcome: RunReviewOutcome | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

/** Uma reprovação precisa de dev: sem ele o retorno não tem a quem ser atribuído. Devolve a mensagem de erro, ou null. */
export function validateReview(input: ReviewInput): string | null {
  if (input.outcome === "rejected" && !input.devId) {
    return "Escolha o dev responsável: a reprovação conta como um retorno pra ele.";
  }
  return null;
}

/**
 * Os campos da execução que guardam a avaliação. Sem resultado ("não se aplica"), nada de data nem autor. Se o
 * resultado não mudou (só a tarefa ou o dev foram corrigidos), mantém quando e quem avaliou, em vez de reescrever.
 */
export function buildReviewPatch(input: ReviewInput, previous: ReviewPrevious | null, userId: string | null, nowIso: string) {
  const base = {
    task_ref: cleanTaskRef(input.taskRef),
    dev_contact_id: input.devId || null,
    review_outcome: input.outcome,
  };
  if (input.outcome === null) return { ...base, reviewed_at: null, reviewed_by: null };
  if (previous?.review_outcome === input.outcome && previous.reviewed_at) {
    return { ...base, reviewed_at: previous.reviewed_at, reviewed_by: previous.reviewed_by };
  }
  return { ...base, reviewed_at: nowIso, reviewed_by: userId };
}

/** O dev que mais aparece entre os defeitos da execução (empate: o primeiro). Serve de sugestão ao reprovar. */
export function suggestDevId(defectDevIds: (string | null | undefined)[]): string | null {
  const counts = new Map<string, number>();
  for (const id of defectDevIds) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  let best: string | null = null;
  let bestCount = 0;
  for (const [id, count] of counts) {
    if (count > bestCount) {
      best = id;
      bestCount = count;
    }
  }
  return best;
}

/**
 * A situação que a execução mostra nos selos. Uma execução concluída E avaliada mostra o resultado (Aprovada ou
 * Reprovada) no lugar de "Concluído": se foi reprovada, dizer que está "concluída" confunde, porque a tarefa voltou pro
 * dev. Sem avaliação, ou em outro status (ativa, cancelada), vale o status de sempre.
 */
export function runDisplayStatus(status: string, outcome: RunReviewOutcome | null): { label: string; variant: NonNullable<BadgeProps["variant"]> } {
  if (status === "completed" && outcome === "approved") return { label: "Aprovada", variant: "success" };
  if (status === "completed" && outcome === "rejected") return { label: "Reprovada", variant: "danger" };
  return { label: statusLabel(status), variant: statusBadgeVariant(status) };
}
