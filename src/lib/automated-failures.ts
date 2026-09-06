import { supabase } from "@/lib/supabase";

interface RecordFailureParams {
  runCaseId: string;
  projectId: string;
  testCaseTitle: string;
  durationSeconds: number;
  output: string;
  screenshotBase64: string | null;
  userId?: string;
}

/**
 * Grava uma falha automatizada "crua" — sem decidir se é bug, flaky ou
 * lentidão do app. Essa decisão fica pra depois, na aba "Falhas
 * automatizadas" da execução.
 */
export async function recordAutomatedFailure({
  runCaseId,
  projectId,
  testCaseTitle,
  durationSeconds,
  output,
  screenshotBase64,
  userId,
}: RecordFailureParams): Promise<{ error: string | null }> {
  let screenshotPath: string | null = null;

  if (screenshotBase64) {
    try {
      const byteChars = atob(screenshotBase64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: "image/png" });
      const path = `${projectId}/automated-failures/${Date.now()}-${runCaseId}.png`;
      const { error: upErr } = await supabase.storage.from("evidence").upload(path, blob, { contentType: "image/png" });
      if (!upErr) screenshotPath = path;
    } catch {
      // Upload do print é um "bônus" — se falhar, o registro de falha
      // continua sendo criado, só sem o print.
    }
  }

  const { error } = await supabase.from("automated_failures").insert({
    test_run_case_id: runCaseId,
    project_id: projectId,
    test_case_title: testCaseTitle,
    duration_seconds: durationSeconds,
    output,
    screenshot_path: screenshotPath,
    created_by: userId,
  });

  return { error: error?.message ?? null };
}

export async function getFailureScreenshotUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("evidence").createSignedUrl(path, 300);
  if (error) return null;
  return data.signedUrl;
}
