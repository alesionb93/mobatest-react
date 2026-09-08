import { supabase } from "@/lib/supabase";
import Papa from "papaparse";
import type { FailureRow } from "@/pages/test-runs/automated-failures-list";
import { parseMaestroOutput } from "@/lib/maestro-log";

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

const STATUS_LABEL: Record<string, string> = {
  new: "Novo",
  flaky: "Flaky",
  promoted: "Virou defeito",
  ignored: "Ignorado",
};

/**
 * Exporta a lista de falhas automatizadas pra CSV — útil pra mandar um
 * lote grande pra alguém analisar fora do app, sem precisar abrir cada
 * falha uma por uma.
 */
export function exportFailuresToCSV(failures: FailureRow[], filename = "falhas-automatizadas.csv") {
  const header = ["Caso", "Execução", "Status", "Duração (s)", "Ocorrido em", "Log"];
  const rows = failures.map((f) => [
    f.test_case_title,
    f.test_run_case?.test_run?.title ?? "",
    STATUS_LABEL[f.status] ?? f.status,
    f.duration_seconds?.toString() ?? "",
    new Date(f.occurred_at).toLocaleString("pt-BR"),
    (f.output ?? "").replace(/\r?\n/g, " | "),
  ]);

  const csvText = "\uFEFF" + Papa.unparse([header, ...rows], { newline: "\r\n" });
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Exporta a lista de falhas automatizadas em PDF — pensado pra abrir em
 * qualquer PC (só precisa de leitor de PDF, não de Excel/Office). Usa o
 * mesmo checklist com mensagens amigáveis que aparece quando você expande
 * uma falha na tela, em vez de despejar o log cru.
 */
export async function exportFailuresToPDF(failures: FailureRow[], title = "Falhas automatizadas") {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const maxWidth = pageWidth - margin * 2;
  const indent = 14;
  let y = margin;

  function ensureSpace(neededHeight: number) {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function writeWrapped(text: string, x: number, width: number, size: number, opts: { bold?: boolean; color?: number } = {}) {
    doc.setFontSize(size);
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setTextColor(opts.color ?? 0);
    const lines = doc.splitTextToSize(text, width);
    for (const line of lines) {
      ensureSpace(size * 1.3);
      doc.text(line, x, y);
      y += size * 1.3;
    }
    doc.setTextColor(0);
  }

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, margin, y);
  y += 18;
  writeWrapped(`Exportado em ${new Date().toLocaleString("pt-BR")} — ${failures.length} falha(s)`, margin, maxWidth, 9, {
    color: 120,
  });
  y += 10;

  failures.forEach((f, i) => {
    ensureSpace(50);
    writeWrapped(`${i + 1}. ${f.test_case_title}`, margin, maxWidth, 12, { bold: true });

    const meta = [
      f.test_run_case?.test_run?.title && `Execução: ${f.test_run_case.test_run.title}`,
      `Status: ${STATUS_LABEL[f.status] ?? f.status}`,
      f.duration_seconds != null && `Duração: ${f.duration_seconds}s`,
      `Ocorrido em: ${new Date(f.occurred_at).toLocaleString("pt-BR")}`,
    ]
      .filter(Boolean)
      .join("   ·   ");
    writeWrapped(meta, margin, maxWidth, 9, { color: 90 });
    y += 6;

    const parsed = parseMaestroOutput(f.output ?? "");

    if (parsed.steps.length > 0) {
      if (parsed.flow || parsed.device) {
        const line = [parsed.flow && `Fluxo: ${parsed.flow}`, parsed.device && `Dispositivo: ${parsed.device}`]
          .filter(Boolean)
          .join(" · ");
        writeWrapped(line, margin + indent, maxWidth - indent, 8, { color: 130 });
        y += 3;
      }
      parsed.steps.forEach((step) => {
        const marker = step.status === "passed" ? "[OK]" : "[FALHOU]";
        ensureSpace(11);
        writeWrapped(`${marker} ${step.label}`, margin + indent, maxWidth - indent, 9, {
          bold: step.status === "failed",
        });
        if (step.status === "failed") {
          if (step.friendlyReason) {
            writeWrapped(step.friendlyReason.title, margin + indent * 2, maxWidth - indent * 2, 9, {
              bold: true,
              color: 180,
            });
            writeWrapped(step.friendlyReason.body, margin + indent * 2, maxWidth - indent * 2, 8, { color: 90 });
          } else if (step.detail) {
            const excerpt = step.detail.length > 500 ? step.detail.slice(0, 500) + " (...)" : step.detail;
            writeWrapped(excerpt, margin + indent * 2, maxWidth - indent * 2, 8, { color: 130 });
          }
          y += 3;
        }
      });
    } else if (parsed.globalFailure) {
      writeWrapped(parsed.globalFailure.title, margin + indent, maxWidth - indent, 10, { bold: true, color: 180 });
      writeWrapped(parsed.globalFailure.body, margin + indent, maxWidth - indent, 9, { color: 90 });
    } else if (f.output) {
      const excerpt = f.output.length > 1500 ? f.output.slice(0, 1500) + " (...)" : f.output;
      doc.setFont("courier", "normal");
      writeWrapped(excerpt.replace(/\r?\n/g, "  "), margin + indent, maxWidth - indent, 8, { color: 100 });
    }

    y += 12;
    ensureSpace(1);
    doc.setDrawColor(220);
    doc.line(margin, y - 8, pageWidth - margin, y - 8);
  });

  doc.save(`falhas-automatizadas-${new Date().toISOString().slice(0, 10)}.pdf`);
}
