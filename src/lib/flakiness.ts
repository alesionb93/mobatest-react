import { supabase } from "@/lib/supabase";

const WINDOW_SIZE = 8;
const MIN_ALTERNATIONS = 3;

export interface FlakinessResult {
  isFlaky: boolean;
  alternations: number;
  windowSize: number;
}

/**
 * Conta quantas vezes o resultado alternou entre "passed" e "failed" nas
 * últimas execuções (mais recente primeiro). 3+ alternações na janela
 * analisada é o sinal de que pode ser flaky, não bug de verdade.
 */
export function detectFlakiness(recentStatusesNewestFirst: string[]): FlakinessResult {
  const window = recentStatusesNewestFirst.slice(0, WINDOW_SIZE).filter((s) => s === "passed" || s === "failed");
  let alternations = 0;
  for (let i = 0; i < window.length - 1; i++) {
    if (window[i] !== window[i + 1]) alternations++;
  }
  return { isFlaky: alternations >= MIN_ALTERNATIONS, alternations, windowSize: window.length };
}

/** Busca o histórico recente de um caso (cross-execução) e já devolve a análise de flakiness. */
export async function checkCaseFlakiness(testCaseId: string): Promise<FlakinessResult> {
  const { data } = await supabase
    .from("test_run_cases")
    .select("status, executed_at")
    .eq("test_case_id", testCaseId)
    .not("executed_at", "is", null)
    .order("executed_at", { ascending: false })
    .limit(WINDOW_SIZE);

  const statuses = (data ?? []).map((d) => d.status as string);
  return detectFlakiness(statuses);
}
