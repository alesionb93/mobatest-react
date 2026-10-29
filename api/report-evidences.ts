/**
 * Evidências do relatório público (Vercel Function).
 *
 *   GET /api/report-evidences?token=<report_token>
 *
 * Por quê existe: as fotos e vídeos ficam num bucket PRIVADO do Supabase, e quem abre o link
 * público não tem login — o navegador dele não consegue abrir os arquivos. Em vez de abrir o
 * bucket (o que expõe TODAS as evidências e anexos do sistema), esta função faz o papel de
 * porteiro, no servidor:
 *
 *   1. confere que o token pertence a uma execução com link público ATIVO;
 *   2. busca só as evidências DAQUELA execução;
 *   3. devolve links temporários (1 hora) para esses arquivos.
 *
 * A chave SUPABASE_SERVICE_ROLE_KEY dá acesso total ao projeto: só existe nas variáveis de
 * ambiente do Vercel — nunca no código, nunca no navegador. Por isso toda a verificação acima
 * é obrigatória: é ela que impede que um link abra evidências de outra execução.
 *
 * Variáveis de ambiente (Vercel → Settings → Environment Variables):
 *   SUPABASE_URL                (opcional: se faltar, usa VITE_SUPABASE_URL, que o build já tem)
 *   SUPABASE_SERVICE_ROLE_KEY   (obrigatória)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "evidence";
/** Validade dos links dos arquivos. Desligar o link público bloqueia pedidos novos na hora. */
const LINK_TTL_SECONDS = 3600;
/** Teto de evidências por relatório (proteção contra execuções enormes). */
const MAX_EVIDENCES = 300;
/** Ids por consulta: a lista vai na URL, e 100 UUIDs já são ~4 KB. */
const IDS_PER_QUERY = 100;
/** Só letras, números e hífen: cobre UUID e qualquer outro formato de token, e barra o resto. */
const TOKEN_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export interface PublicEvidence {
  id: string;
  /** Id do caso DENTRO da execução (test_run_cases.id). */
  testRunCaseId: string;
  /** Id do caso de teste (test_cases.id). A página casa por qualquer um dos dois. */
  testCaseId: string | null;
  fileName: string;
  contentType: string;
  fileSize: number;
  url: string;
}

export interface Outcome {
  status: number;
  body: unknown;
}

interface RunCaseRow {
  id: string;
  test_case_id: string | null;
}
interface EvidenceRow {
  id: string;
  test_run_case_id: string;
  file_name: string;
  file_type: string;
  file_size: number | string;
  storage_path: string;
}

function chunk<T>(items: T[], size: number): T[][] {
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size) parts.push(items.slice(i, i + size));
  return parts;
}

/** Toda a regra de acesso mora aqui, separada do HTTP pra poder ser testada. */
export async function buildEvidenceResponse(db: SupabaseClient, token: string | undefined): Promise<Outcome> {
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
  const casesRes = await db.from("test_run_cases").select("id, test_case_id").eq("test_run_id", runId);
  if (casesRes.error) throw casesRes.error;
  const runCases = (casesRes.data ?? []) as RunCaseRow[];
  if (runCases.length === 0) return { status: 200, body: { evidences: [] } };
  const testCaseByRunCase = new Map(runCases.map((c) => [c.id, c.test_case_id]));

  // 3) As evidências desses casos (em lotes, pra a URL da consulta não estourar).
  const rows: EvidenceRow[] = [];
  for (const ids of chunk(runCases.map((c) => c.id), IDS_PER_QUERY)) {
    const res = await db
      .from("run_case_evidences")
      .select("id, test_run_case_id, file_name, file_type, file_size, storage_path")
      .in("test_run_case_id", ids)
      .order("created_at")
      .limit(MAX_EVIDENCES);
    if (res.error) throw res.error;
    rows.push(...((res.data ?? []) as EvidenceRow[]));
  }
  // Só foto e vídeo vão pra um relatório público.
  const media = rows
    .filter((r) => r.file_type.startsWith("image/") || r.file_type.startsWith("video/"))
    .slice(0, MAX_EVIDENCES);
  if (media.length === 0) return { status: 200, body: { evidences: [] } };

  // 4) Links temporários. Um arquivo que não foi possível assinar (ex: sumiu do Storage) é
  //    pulado — não pode derrubar o relatório inteiro.
  const signRes = await db.storage.from(BUCKET).createSignedUrls(
    media.map((r) => r.storage_path),
    LINK_TTL_SECONDS
  );
  if (signRes.error) throw signRes.error;
  const urlByPath = new Map<string, string>();
  for (const s of signRes.data ?? []) {
    if (!s.error && s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
  }

  const evidences: PublicEvidence[] = [];
  for (const r of media) {
    const url = urlByPath.get(r.storage_path);
    if (!url) continue;
    evidences.push({
      id: r.id,
      testRunCaseId: r.test_run_case_id,
      testCaseId: testCaseByRunCase.get(r.test_run_case_id) ?? null,
      fileName: r.file_name,
      contentType: r.file_type,
      fileSize: Number(r.file_size),
      url,
    });
  }
  return { status: 200, body: { evidences } };
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
  // Os links temporários não podem ser guardados em cache: se o relatório for revogado, some.
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "metodo_nao_permitido" });
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("report-evidences: faltam variáveis de ambiente (SUPABASE_SERVICE_ROLE_KEY e/ou a URL).");
    return res.status(500).json({ error: "configuracao_ausente" });
  }

  const token = typeof req.query.token === "string" ? req.query.token : undefined;
  try {
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const outcome = await buildEvidenceResponse(db, token);
    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    // O motivo real fica só no log do servidor; quem chamou recebe uma resposta genérica.
    console.error("report-evidences: falha:", error instanceof Error ? error.message : error);
    return res.status(500).json({ error: "falha_interna" });
  }
}
