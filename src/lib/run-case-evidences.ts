import { supabase } from "@/lib/supabase";
import type { CompressedMedia } from "@/lib/media-compress";
import type { RunCaseEvidence } from "@/types/test-runs";

// Mesmo bucket (privado) dos anexos de defeito.
const BUCKET = "evidence";

/** Chaves do Storage não aceitam acento/espaço de forma confiável — o nome bonito fica na tabela. */
export function safeStorageName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(-80) || "arquivo";
}

export async function listEvidences(runCaseId: string): Promise<{ data: RunCaseEvidence[]; error: string | null }> {
  const { data, error } = await supabase
    .from("run_case_evidences")
    .select("*")
    .eq("test_run_case_id", runCaseId)
    .order("created_at");
  return { data: (data as RunCaseEvidence[]) ?? [], error: error?.message ?? null };
}

interface UploadParams {
  projectId: string;
  runCaseId: string;
  userId: string;
  media: CompressedMedia;
}

/** Sobe o arquivo (já comprimido) e grava o registro. Se o registro falhar, desfaz o upload. */
export async function uploadEvidence({ projectId, runCaseId, userId, media }: UploadParams): Promise<{ error: string | null }> {
  const path = `${projectId}/run-case-evidences/${runCaseId}/${Date.now()}-${safeStorageName(media.fileName)}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, media.blob, {
    contentType: media.fileType,
    upsert: false,
  });
  if (upErr) return { error: upErr.message };

  const { error: insErr } = await supabase.from("run_case_evidences").insert({
    test_run_case_id: runCaseId,
    storage_path: path,
    file_name: media.fileName,
    file_type: media.fileType,
    file_size: media.size,
    original_size: media.originalSize,
    created_by: userId,
  });
  if (insErr) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: insErr.message };
  }
  return { error: null };
}

/** Apaga o registro primeiro (é a fonte da verdade) e depois o arquivo. */
export async function deleteEvidence(evidence: RunCaseEvidence): Promise<{ error: string | null }> {
  const { error } = await supabase.from("run_case_evidences").delete().eq("id", evidence.id);
  if (error) return { error: error.message };
  await supabase.storage.from(BUCKET).remove([evidence.storage_path]);
  return { error: null };
}

export async function getEvidenceUrl(storagePath: string, expiresInSeconds: number): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  return error || !data ? null : data.signedUrl;
}

// ---------------------------------------------------------------------------
// Limpeza de arquivos órfãos
//
// Apagar uma execução (ou tirar casos dela, ou apagar um caso de teste) leva as
// linhas de evidência junto, em cascata — mas NÃO leva os arquivos do Storage.
// Sem isso eles ficariam ocupando espaço pra sempre. O fluxo é:
//   1) coletar os caminhos ANTES de apagar (depois a linha já sumiu);
//   2) apagar o dado normalmente;
//   3) só se deu certo, remover os arquivos.
// É "melhor esforço": se a limpeza falhar, não atrapalha a exclusão em si.
// ---------------------------------------------------------------------------

export type EvidenceScope = { runId: string } | { runCaseIds: string[] } | { testCaseIds: string[] };

export async function collectEvidencePaths(scope: EvidenceScope): Promise<string[]> {
  try {
    let query = supabase.from("run_case_evidences").select("storage_path, test_run_cases!inner(test_run_id, test_case_id)");
    if ("runId" in scope) {
      query = query.eq("test_run_cases.test_run_id", scope.runId);
    } else if ("runCaseIds" in scope) {
      if (scope.runCaseIds.length === 0) return [];
      query = query.in("test_run_case_id", scope.runCaseIds);
    } else {
      if (scope.testCaseIds.length === 0) return [];
      query = query.in("test_run_cases.test_case_id", scope.testCaseIds);
    }
    const { data } = await query;
    return ((data ?? []) as { storage_path: string }[]).map((r) => r.storage_path);
  } catch {
    return [];
  }
}

export async function removeEvidenceFiles(paths: string[]): Promise<void> {
  try {
    for (let i = 0; i < paths.length; i += 100) {
      await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    }
  } catch {
    // melhor esforço
  }
}
