import { supabase } from "@/lib/supabase";
import type { RunCaseResultStatus } from "@/types/test-runs";

export interface RunCaseStatusPatch {
  status: RunCaseResultStatus;
  executed_by?: string | null;
  executed_at?: string;
  duration_seconds?: number | null;
  comment?: string;
  [key: string]: unknown;
}

/**
 * Atualiza o status de um caso dentro de uma execução. Se ele já tinha um
 * resultado (diferente de "untested"), guarda essa tentativa anterior em
 * test_run_case_attempts antes de sobrescrever, e incrementa retest_count —
 * assim nenhum log/print/comentário de uma tentativa anterior se perde só
 * porque o caso foi testado de novo.
 */
export async function updateRunCaseStatus(
  runCaseId: string,
  patch: RunCaseStatusPatch,
  source: "manual" | "automated"
): Promise<{ error: string | null }> {
  const { data: current, error: fetchError } = await supabase
    .from("test_run_cases")
    .select("status, comment, duration_seconds, executed_by, executed_at, retest_count")
    .eq("id", runCaseId)
    .single();

  if (fetchError) {
    return { error: fetchError.message };
  }

  let nextRetestCount = current.retest_count ?? 0;

  if (current.status && current.status !== "untested") {
    // Já tinha um resultado — essa tentativa anterior vira histórico antes
    // de ser sobrescrita.
    nextRetestCount += 1;
    const { error: insertError } = await supabase.from("test_run_case_attempts").insert({
      test_run_case_id: runCaseId,
      attempt_number: nextRetestCount,
      status: current.status,
      comment: current.comment,
      duration_seconds: current.duration_seconds,
      executed_by: current.executed_by,
      executed_at: current.executed_at,
      source,
    });
    if (insertError) {
      return { error: insertError.message };
    }
  }

  const { error: updateError } = await supabase
    .from("test_run_cases")
    .update({ ...patch, retest_count: nextRetestCount })
    .eq("id", runCaseId);

  if (updateError) {
    return { error: updateError.message };
  }

  return { error: null };
}
