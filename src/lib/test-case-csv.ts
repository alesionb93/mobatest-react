import Papa from "papaparse";
import type { TestCaseInput } from "@/types/test-cases";
import { statusLabel } from "@/lib/labels";
import type { TestCase } from "@/types/test-cases";

const IMPORT_PRIORITY_MAP: Record<string, TestCaseInput["priority"]> = {
  baixa: "low",
  media: "medium",
  alta: "high",
  critica: "critical",
};
const IMPORT_SEVERITY_MAP: Record<string, TestCaseInput["severity"]> = {
  menor: "minor",
  normal: "normal",
  maior: "major",
  critica: "critical",
};
const IMPORT_TYPE_MAP: Record<string, TestCaseInput["type"]> = {
  funcional: "functional",
  regressao: "regression",
  smoke: "smoke",
  integracao: "integration",
  e2e: "e2e",
  performance: "performance",
  seguranca: "security",
  usabilidade: "usability",
  outro: "other",
};
const IMPORT_AUTOMATION_MAP: Record<string, TestCaseInput["automation_status"]> = {
  manual: "manual",
  automatizado: "automated",
  "a automatizar": "to_automate",
};

function normalizeKey(str: string | undefined): string {
  return (str ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function textToHtmlParagraphs(text: string | undefined): string {
  if (!text) return "";
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p>${escapeHtml(l)}</p>`)
    .join("");
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  div.querySelectorAll("p, li, div, br, hr").forEach((el) => {
    el.insertAdjacentText("afterend", "\n");
  });
  return (div.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

export interface ParsedImportResult {
  cases: (TestCaseInput & { description: string })[];
  skipped: number;
}

export function parseImportCSV(csvText: string): ParsedImportResult {
  const parsed = Papa.parse<string[]>(csvText, { skipEmptyLines: true });
  const rows = parsed.data;
  if (rows.length === 0) return { cases: [], skipped: 0 };

  const header = rows[0].map(normalizeKey);
  const colIndex = (names: string[]) => header.findIndex((h) => names.includes(h));

  const idx = {
    title: colIndex(["titulo", "título"]),
    description: colIndex(["descricao", "descrição"]),
    preconditions: colIndex(["pre-requisitos", "prerequisitos", "pre requisitos"]),
    repro: colIndex(["passos para reproducao", "passos para reprodução"]),
    expected: colIndex(["resultado esperado"]),
    priority: colIndex(["prioridade"]),
    severity: colIndex(["severidade"]),
    type: colIndex(["tipo"]),
    automation: colIndex(["automacao", "automação"]),
  };

  const cases: (TestCaseInput & { description: string })[] = [];
  let skipped = 0;

  rows.slice(1).forEach((row) => {
    const title = idx.title !== -1 ? (row[idx.title] || "").trim() : "";
    if (!title) {
      skipped++;
      return;
    }
    cases.push({
      title,
      suite_id: null,
      status: "active",
      description: textToHtmlParagraphs(idx.description !== -1 ? row[idx.description] : ""),
      preconditions: textToHtmlParagraphs(idx.preconditions !== -1 ? row[idx.preconditions] : ""),
      repro_steps: textToHtmlParagraphs(idx.repro !== -1 ? row[idx.repro] : ""),
      postconditions: textToHtmlParagraphs(idx.expected !== -1 ? row[idx.expected] : ""),
      priority: IMPORT_PRIORITY_MAP[normalizeKey(idx.priority !== -1 ? row[idx.priority] : "")] ?? "medium",
      severity: IMPORT_SEVERITY_MAP[normalizeKey(idx.severity !== -1 ? row[idx.severity] : "")] ?? "normal",
      type: IMPORT_TYPE_MAP[normalizeKey(idx.type !== -1 ? row[idx.type] : "")] ?? "functional",
      automation_status:
        IMPORT_AUTOMATION_MAP[normalizeKey(idx.automation !== -1 ? row[idx.automation] : "")] ?? "manual",
      automation_script_path: null,
    });
  });

  return { cases, skipped };
}

export function downloadImportTemplateCSV() {
  const rows = [
    [
      "Titulo",
      "Descricao",
      "Pre-requisitos",
      "Passos para reproducao",
      "Resultado esperado",
      "Prioridade",
      "Severidade",
      "Tipo",
      "Automacao",
    ],
    [
      "Realizar login com sucesso",
      "Cenário que valida o login com sucesso no app",
      "",
      "1. Abra o app\n2. Insira usuário e senha válidos\n3. Clique em \"Acessar\"",
      "Dado que estou na tela de login\nQuando eu clicar em \"Acessar\"\nEntão devo entrar no app",
      "Alta",
      "Normal",
      "Funcional",
      "Manual",
    ],
  ];
  downloadCSV(rows, "modelo-importacao-casos-de-teste.csv");
}

export function exportCasesToCSV(
  cases: TestCase[],
  suiteTitleById: Record<string, string>,
  projectCode: string
) {
  const header = [
    "ID",
    "Suite",
    "Titulo",
    "Descricao",
    "Pre-requisitos",
    "Passos para reproducao",
    "Resultado esperado",
    "Prioridade",
    "Severidade",
    "Tipo",
    "Automacao",
  ];
  const rows = cases.map((c) => [
    `${projectCode}-${c.seq}`,
    c.suite_id ? suiteTitleById[c.suite_id] ?? "" : "",
    c.title,
    htmlToPlainText(c.description),
    htmlToPlainText(c.preconditions),
    htmlToPlainText(c.repro_steps),
    htmlToPlainText(c.postconditions),
    statusLabel(c.priority),
    statusLabel(c.severity),
    statusLabel(c.type),
    statusLabel(c.automation_status),
  ]);
  downloadCSV([header, ...rows], `${projectCode}-casos-de-teste.csv`);
}

function downloadCSV(rows: string[][], filename: string) {
  const csvText = "\uFEFF" + Papa.unparse(rows, { newline: "\r\n" });
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
