/**
 * Conteúdo dos testes (o "template") de um relatório público (Vercel Function).
 *
 *   GET /api/report-cases?token=<report_token>
 *
 * Por quê existe: a função do banco que monta o relatório público (get_public_report) devolve só
 * título, status e comentário de cada caso — não a descrição, os pré-requisitos, os passos nem o
 * resultado esperado. Esta função devolve esses quatro campos, só dos casos DAQUELA execução.
 *
 * Mesma regra de acesso de api/report-evidences.ts, pelo mesmo motivo: ela usa a chave de serviço
 * (acesso total ao projeto), então a barreira inteira é "o token bate com uma execução com link
 * público ATIVO" e "só saem os casos dessa execução". Token errado e link desativado respondem
 * igual (404).
 *
 * Variáveis de ambiente: as mesmas de api/report-evidences.ts (nada novo a configurar).
 *   SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Teto de casos por relatório (proteção contra execuções enormes). */
const MAX_CASES = 500;
/** Ids por consulta: a lista vai na URL, e 100 UUIDs já são ~4 KB. */
const IDS_PER_QUERY = 100;
/** Só letras, números e hífen: cobre UUID e qualquer outro formato de token, e barra o resto. */
const TOKEN_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export interface CaseTemplate {
  /** Id do caso DENTRO da execução (test_run_cases.id). */
  testRunCaseId: string;
  /** Id do caso de teste (test_cases.id). A página casa por qualquer um dos dois. */
  testCaseId: string;
  description: string | null;
  preconditions: string | null;
  reproSteps: string | null;
  /** Resultado esperado (na tabela test_cases, a coluna se chama postconditions). */
  expectedResult: string | null;
}

export interface Outcome {
  status: number;
  body: unknown;
}

interface RunCaseRow {
  id: string;
  test_case_id: string | null;
}
interface TestCaseRow {
  id: string;
  description: string | null;
  preconditions: string | null;
  repro_steps: string | null;
  postconditions: string | null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size) parts.push(items.slice(i, i + size));
  return parts;
}

/** Toda a regra de acesso mora aqui, separada do HTTP pra poder ser testada. */
export async function buildCaseTemplatesResponse(db: SupabaseClient, token: string | undefined): Promise<Outcome> {
  if (!token || !TOKEN_PATTERN.test(token)) {
    return { status: 400, body: { error: "token_invalido" } };
  }

  // 1) O token precisa ser de uma execução com link público ATIVO. Sem isso, nada sai.
  const runRes = await db
    .from("test_runs")
    .select("id")
    .eq("report_token", token)
    .eq("is_public", true)
    .maybeSingle();
  if (runRes.error) throw runRes.error;
  if (!runRes.data) return { status: 404, body: { error: "nao_encontrado" } };
  const runId = (runRes.data as { id: string }).id;

  // 2) Os casos DESTA execução — e só eles.
  const casesRes = await db
    .from("test_run_cases")
    .select("id, test_case_id")
    .eq("test_run_id", runId)
    .limit(MAX_CASES);
  if (casesRes.error) throw casesRes.error;
  const runCases = ((casesRes.data ?? []) as RunCaseRow[]).filter((c) => c.test_case_id);
  if (runCases.length === 0) return { status: 200, body: { cases: [] } };

  // 3) O conteúdo desses testes (em lotes, pra a URL da consulta não estourar). Só os 4 campos do
  //    template: nenhuma outra coluna de test_cases sai daqui.
  const byId = new Map<string, TestCaseRow>();
  const testCaseIds = [...new Set(runCases.map((c) => c.test_case_id as string))];
  for (const ids of chunk(testCaseIds, IDS_PER_QUERY)) {
    const res = await db
      .from("test_cases")
      .select("id, description, preconditions, repro_steps, postconditions")
      .in("id", ids);
    if (res.error) throw res.error;
    for (const row of (res.data ?? []) as TestCaseRow[]) byId.set(row.id, row);
  }

  const cases: CaseTemplate[] = [];
  for (const rc of runCases) {
    const tc = byId.get(rc.test_case_id as string);
    if (!tc) continue; // caso de teste apagado depois da execução: fica sem conteúdo, sem erro
    cases.push({
      testRunCaseId: rc.id,
      testCaseId: tc.id,
      description: tc.description,
      preconditions: tc.preconditions,
      reproSteps: tc.repro_steps,
      expectedResult: tc.postconditions,
    });
  }
  return { status: 200, body: { cases } };
}

// Só o que a função usa do pedido/resposta do Vercel (evita depender do pacote de tipos deles).
interface Req {
  method?: string;
  query: Record<string, string | string[] | undefined>;
}
interface Res {
  status(code: number): Res;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
}

export default async function handler(req: Req, res: Res) {
  // Se o link for desativado, o conteúdo não pode continuar saindo de um cache.
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "metodo_nao_permitido" });
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("report-cases: faltam variáveis de ambiente (SUPABASE_SERVICE_ROLE_KEY e/ou a URL).");
    return res.status(500).json({ error: "configuracao_ausente" });
  }

  const token = typeof req.query.token === "string" ? req.query.token : undefined;
  try {
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const outcome = await buildCaseTemplatesResponse(db, token);
    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    // O motivo real fica só no log do servidor; quem chamou recebe uma resposta genérica.
    console.error("report-cases: falha:", error instanceof Error ? error.message : error);
    return res.status(500).json({ error: "falha_interna" });
  }
}
