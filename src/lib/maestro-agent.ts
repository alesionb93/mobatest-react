const AGENT_BASE = "http://127.0.0.1:4545";

export interface MaestroJobResult {
  status: "passed" | "failed";
  duration: number;
  output: string;
  screenshotBase64: string | null;
}

export type MaestroJobPoll =
  | { ok: true; status: "running" }
  | ({ ok: true } & MaestroJobResult)
  | { ok: false; error: string };

const AGENT_UNREACHABLE_MSG =
  "Não consegui conectar ao executor local — ele está rodando? (veja maestro-agent/README.md)";

export async function openDeviceMirror(
  position?: { x: number; y: number }
): Promise<{ ok: true; alreadyOpen?: boolean } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${AGENT_BASE}/mirror/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(position ?? {}),
    });
    return await res.json();
  } catch {
    return { ok: false, error: AGENT_UNREACHABLE_MSG };
  }
}

export async function closeDeviceMirror(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${AGENT_BASE}/mirror/close`, { method: "POST" });
    return await res.json();
  } catch {
    return { ok: false, error: AGENT_UNREACHABLE_MSG };
  }
}

export async function getDeviceMirrorStatus(): Promise<{ ok: true; open: boolean } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${AGENT_BASE}/mirror/status`);
    return await res.json();
  } catch {
    return { ok: false, error: AGENT_UNREACHABLE_MSG };
  }
}

export async function startMaestroRun(
  scriptPath: string
): Promise<{ ok: true; jobId: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${AGENT_BASE}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scriptPath }),
    });
    return await res.json();
  } catch {
    return { ok: false, error: AGENT_UNREACHABLE_MSG };
  }
}

export async function pollMaestroJob(jobId: string): Promise<MaestroJobPoll> {
  try {
    const res = await fetch(`${AGENT_BASE}/jobs/${jobId}`);
    return await res.json();
  } catch {
    return { ok: false, error: AGENT_UNREACHABLE_MSG };
  }
}

/**
 * Roda um teste do início ao fim, consultando o andamento em vez de ficar
 * numa única chamada esperando — assim, se a aba recarregar no meio do
 * caminho (o Chrome faz isso sozinho com abas em segundo plano), dá pra
 * reconectar no job pelo jobId em vez de perder o resultado.
 */
export async function runMaestroToCompletion(
  scriptPath: string,
  onJobStarted?: (jobId: string) => void
): Promise<({ ok: true } & MaestroJobResult) | { ok: false; error: string }> {
  const started = await startMaestroRun(scriptPath);
  if (!started.ok) return started;
  onJobStarted?.(started.jobId);
  return resumeMaestroJob(started.jobId);
}

export async function resumeMaestroJob(
  jobId: string
): Promise<({ ok: true } & MaestroJobResult) | { ok: false; error: string }> {
  while (true) {
    const data = await pollMaestroJob(jobId);
    if (!data.ok) return data;
    if (data.status === "running") {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    return data;
  }
}
