import Papa from "papaparse";
import { statusLabel } from "@/lib/labels";
import { formatDuration, profileName, stripHtml, flattenGroups, type SuiteGroup } from "@/pages/test-runs/run-helpers";
import type { TestRun, Profile } from "@/types/test-runs";

export function exportRunAsCSV(
  run: TestRun,
  groups: SuiteGroup[],
  notes: string,
  profilesMap: Record<string, Profile>,
  projectCode: string
) {
  const rows: string[][] = [];
  rows.push(["Execução", run.title]);
  rows.push(["Ambiente", run.environment || "—"]);
  rows.push(["Observações", notes || "—"]);
  rows.push([]);
  rows.push(["ID", "Suíte", "Título", "Prioridade", "Status", "Responsável", "Duração", "Comentário"]);

  groups.forEach((g) => {
    g.cases.forEach((rc) => {
      rows.push([
        `${projectCode}-${rc.test_cases.seq}`,
        g.title,
        rc.test_cases.title,
        statusLabel(rc.test_cases.priority),
        statusLabel(rc.status),
        profileName(rc.assignee_id, profilesMap),
        formatDuration(rc.duration_seconds),
        stripHtml(rc.comment),
      ]);
    });
  });

  const csvText = "\uFEFF" + Papa.unparse(rows, { newline: "\r\n" });
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${run.title.replace(/[^\w-]+/g, "_")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(s: string) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

export function exportRunAsPDF(
  run: TestRun,
  groups: SuiteGroup[],
  notes: string,
  profilesMap: Record<string, Profile>,
  projectCode: string
) {
  const w = window.open("", "_blank");
  if (!w) {
    alert("Seu navegador bloqueou a janela de exportação. Permita pop-ups para este site.");
    return;
  }

  const allCases = flattenGroups(groups);
  const counts: Record<string, number> = { passed: 0, failed: 0, blocked: 0, skipped: 0, pre_existing: 0, untested: 0 };
  allCases.forEach((rc) => {
    const s = rc.status || "untested";
    counts[s] = (counts[s] ?? 0) + 1;
  });
  const total = allCases.length || 1;
  const executed = allCases.filter((rc) => rc.status && rc.status !== "untested").length;
  const pct = Math.round((executed / total) * 100);
  const totalDurationSeconds = allCases.reduce((sum, rc) => sum + (rc.duration_seconds ?? 0), 0);

  const sectionsHtml = groups
    .map(
      (g) => `
    <h3>${escapeHtml(g.title)}</h3>
    <table>
      <thead><tr><th>ID</th><th>Título</th><th>Prioridade</th><th>Status</th><th>Responsável</th><th>Duração</th></tr></thead>
      <tbody>
        ${g.cases
          .map(
            (rc) => `
          <tr>
            <td>${projectCode}-${rc.test_cases.seq}</td>
            <td>${escapeHtml(rc.test_cases.title)}</td>
            <td>${escapeHtml(statusLabel(rc.test_cases.priority))}</td>
            <td>${escapeHtml(statusLabel(rc.status))}</td>
            <td>${escapeHtml(profileName(rc.assignee_id, profilesMap))}</td>
            <td>${formatDuration(rc.duration_seconds)}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  `
    )
    .join("");

  const summaryRows = [
    ["Não testado", counts.untested, "#8B98A5"],
    ["Passou", counts.passed, "#0E9F6E"],
    ["Falhou", counts.failed, "#E02424"],
    ["Bloqueado", counts.blocked, "#C27803"],
    ["Pré-existente", counts.pre_existing, "#7E3AF2"],
  ]
    .map(
      ([label, value, color]) =>
        `<div class="legend-row"><span class="dot" style="background:${color};"></span>${escapeHtml(String(label))} (${value})</div>`
    )
    .join("");

  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(run.title)}</title>
    <style>
      body { font-family: Arial, Helvetica, sans-serif; padding: 28px; color: #1a1a1a; }
      h1 { margin-bottom: 2px; }
      h3 { margin-top: 26px; border-bottom: 1px solid #ccc; padding-bottom: 6px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 12px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      th { background: #f0f0f0; }
      .meta { color: #555; font-size: 13px; margin-bottom: 10px; }
      .notes { background: #fff8e1; border: 1px solid #eab308; padding: 10px 14px; margin: 14px 0; border-radius: 6px; font-size: 13px; }
      .summary { display: flex; gap: 30px; align-items: center; border: 1px solid #ddd; border-radius: 10px; padding: 18px 22px; margin-bottom: 20px; flex-wrap: wrap; }
      .legend { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; }
      .legend-row { display: flex; align-items: center; gap: 8px; }
      .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
      .info-grid { display: flex; gap: 34px; flex-wrap: wrap; font-size: 12.5px; }
      .info-grid .label { color: #777; font-size: 11px; text-transform: uppercase; margin-bottom: 3px; }
      .info-grid .value { font-weight: 700; font-size: 14px; }
      .rate { font-size: 26px; font-weight: 800; }
      @media print { a { display: none; } }
    </style>
  </head><body>
    <h1>${escapeHtml(run.title)}</h1>
    <div class="meta">${escapeHtml(run.environment || "Sem ambiente")} — Criada em ${new Date(run.created_at).toLocaleString("pt-BR")}</div>
    ${notes ? `<div class="notes"><strong>Observações:</strong><br>${escapeHtml(notes).replace(/\n/g, "<br>")}</div>` : ""}

    <div class="summary">
      <div class="legend">${summaryRows}</div>
      <div class="info-grid">
        <div><div class="label">Taxa de conclusão</div><div class="rate">${pct}%</div><div class="meta" style="margin:0;">${executed} de ${allCases.length}</div></div>
        <div><div class="label">Iniciado por</div><div class="value">${escapeHtml(profileName(run.created_by, profilesMap))}</div></div>
        <div><div class="label">Início</div><div class="value">${new Date(run.created_at).toLocaleString("pt-BR")}</div></div>
        <div><div class="label">Tempo total testando</div><div class="value">${totalDurationSeconds > 0 ? formatDuration(totalDurationSeconds) : "—"}</div></div>
      </div>
    </div>

    ${sectionsHtml}
    <script>
      window.addEventListener('load', function () {
        setTimeout(function () { window.focus(); window.print(); }, 250);
      });
    <\/script>
  </body></html>`);
  w.document.close();
}
