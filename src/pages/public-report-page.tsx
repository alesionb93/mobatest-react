import * as React from "react";
import { Play } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import veiserIcon from "@/assets/marca/veiser-test-icone-app.svg";
import { statusBadgeVariant, statusLabel } from "@/lib/labels";

interface PublicRunCase {
  id: string;
  status: string;
  comment: string | null;
  duration_seconds: number | null;
  executed_at: string | null;
  case_id: string;
  seq: number;
  title: string;
  priority: string;
  suite_id: string | null;
}
interface PublicSuite {
  id: string;
  title: string;
  parent_suite_id: string | null;
}
interface PublicDefect {
  seq: number;
  title: string;
  severity: string;
  status: string;
  test_run_case_id: string | null;
}
/** Evidência (foto/vídeo) devolvida por /api/report-evidences, já com link temporário. */
interface PublicEvidence {
  id: string;
  testRunCaseId: string;
  testCaseId: string | null;
  fileName: string;
  contentType: string;
  fileSize: number;
  url: string;
}
interface PublicReportData {
  run: {
    id: string;
    title: string;
    environment: string | null;
    status: string;
    created_at: string;
    completed_at: string | null;
    report_notes: string | null;
    project_code: string;
    project_name: string;
  };
  cases: PublicRunCase[];
  suites: PublicSuite[];
  defects: PublicDefect[];
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}
function formatDuration(totalSeconds: number | null) {
  if (!totalSeconds || totalSeconds <= 0) return "—";
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
function stripHtml(html: string | null) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent ?? "";
}

/**
 * Evidências por id de caso. Cada evidência entra sob os DOIS ids (o do caso na execução e o do
 * caso de teste): como são UUIDs, não existe como ligar a evidência ao caso errado, e a página
 * funciona seja qual for o id que a função do banco usa em `cases[].id`.
 */
function indexEvidences(evidences: PublicEvidence[]) {
  const index = new Map<string, PublicEvidence[]>();
  const add = (key: string | null, e: PublicEvidence) => {
    if (!key) return;
    const list = index.get(key);
    if (list) list.push(e);
    else index.set(key, [e]);
  };
  evidences.forEach((e) => {
    add(e.testRunCaseId, e);
    if (e.testCaseId !== e.testRunCaseId) add(e.testCaseId, e);
  });
  return index;
}
function evidencesForCase(c: PublicRunCase, index: Map<string, PublicEvidence[]>) {
  const seen = new Set<string>();
  const found: PublicEvidence[] = [];
  [c.id, c.case_id].forEach((key) => {
    (index.get(key) ?? []).forEach((e) => {
      if (seen.has(e.id)) return;
      seen.add(e.id);
      found.push(e);
    });
  });
  return found;
}

function groupCasesBySuite(cases: PublicRunCase[], suites: PublicSuite[]) {
  const suiteMap: Record<string, PublicSuite> = {};
  suites.forEach((s) => (suiteMap[s.id] = s));
  const bySuite: Record<string, PublicRunCase[]> = {};
  cases.forEach((c) => {
    const key = c.suite_id ?? "none";
    (bySuite[key] = bySuite[key] ?? []).push(c);
  });
  Object.values(bySuite).forEach((arr) => arr.sort((a, b) => a.seq - b.seq));

  const groups: { title: string; cases: PublicRunCase[] }[] = [];
  Object.keys(bySuite).forEach((key) => {
    if (key === "none") return;
    groups.push({ title: suiteMap[key]?.title ?? "Suíte", cases: bySuite[key] });
  });
  if (bySuite["none"]) groups.push({ title: "Sem suíte", cases: bySuite["none"] });
  return groups;
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-10 text-center">
      <h2 className="text-lg font-semibold text-foreground mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function PublicReportPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [data, setData] = React.useState<PublicReportData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [evidences, setEvidences] = React.useState<PublicEvidence[]>([]);

  React.useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    supabase.rpc("get_public_report", { p_token: token }).then(({ data: result, error }) => {
      if (cancelled) return;
      if (error || !result || !(result as PublicReportData).run) {
        setNotFound(true);
      } else {
        setData(result as PublicReportData);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // As evidências vêm depois e por fora: se esse pedido falhar (ou não existir, como no `npm run dev`
  // local), o relatório aparece igual, só sem as miniaturas.
  React.useEffect(() => {
    if (!token || !data) return;
    const controller = new AbortController();
    fetch(`/api/report-evidences?token=${encodeURIComponent(token)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { evidences?: PublicEvidence[] } | null) => {
        if (!body || !Array.isArray(body.evidences)) return;
        // Só links http(s) viram imagem/vídeo na página.
        setEvidences(body.evidences.filter((e) => typeof e.url === "string" && /^https?:\/\//.test(e.url)));
      })
      .catch(() => {});
    return () => controller.abort();
  }, [token, data]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="flex items-center gap-2 mb-6">
          <img src={veiserIcon} alt="Veiser" className="h-6 w-6 rounded-md object-cover" />
          <span className="font-semibold text-sm text-foreground">Veiser Test</span>
          <span className="text-xs text-muted-foreground">· relatório público (somente leitura)</span>
        </div>

        {loading && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {!loading && !token && (
          <Message title="Link inválido" body="Esse link de relatório está incompleto ou incorreto." />
        )}

        {!loading && token && notFound && (
          <Message
            title="Relatório não encontrado"
            body="Esse link é inválido ou o link público desta execução foi desativado pelo autor."
          />
        )}

        {!loading && data && <ReportContent data={data} evidences={evidences} />}
      </div>
    </div>
  );
}

/** Miniaturas das evidências do caso; clicar abre o arquivo inteiro numa aba nova. */
function EvidenceRow({ items }: { items: PublicEvidence[] }) {
  if (items.length === 0) return null;
  return (
    <tr className="border-b border-border">
      <td />
      <td colSpan={4} className="px-4 pb-3">
        <p className="mb-1.5 text-xs text-muted-foreground">Evidências ({items.length})</p>
        <div className="flex flex-wrap gap-2">
          {items.map((e) => (
            <a
              key={e.id}
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              title={e.fileName}
              className="relative block h-20 w-20 overflow-hidden rounded-md border border-border bg-muted"
            >
              {e.contentType.startsWith("video/") ? (
                <>
                  {/* #t=0.1 faz o navegador mostrar um quadro do vídeo como miniatura */}
                  <video src={`${e.url}#t=0.1`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="rounded-full bg-black/60 p-1.5 text-white">
                      <Play size={14} />
                    </span>
                  </span>
                </>
              ) : (
                <img src={e.url} alt={e.fileName} loading="lazy" className="h-full w-full object-cover" />
              )}
            </a>
          ))}
        </div>
      </td>
    </tr>
  );
}

function ReportContent({ data, evidences }: { data: PublicReportData; evidences: PublicEvidence[] }) {
  const { run, cases, suites, defects } = data;
  const evidenceIndex = React.useMemo(() => indexEvidences(evidences), [evidences]);
  const groups = groupCasesBySuite(cases ?? [], suites ?? []);
  const total = (cases ?? []).length || 1;
  const executed = (cases ?? []).filter((c) => c.status && c.status !== "untested").length;
  const pct = Math.round((executed / total) * 100);
  const failed = (cases ?? []).filter((c) => c.status === "failed").length;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              {run.project_name} ({run.project_code})
            </p>
            <h1 className="text-xl font-semibold text-foreground">{run.title}</h1>
            <p className="text-xs text-muted-foreground mt-1">
              {run.environment || "Sem ambiente"} · Criada em {formatDateTime(run.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={statusBadgeVariant(run.status)}>{statusLabel(run.status)}</Badge>
            <div className="text-center">
              <p className="text-xl font-semibold text-foreground">{pct}%</p>
              <p className="text-[11px] text-muted-foreground">
                {executed} de {(cases ?? []).length}
              </p>
            </div>
          </div>
        </div>
        {failed > 0 && <p className="mt-3 text-sm font-semibold text-red-600">{failed} caso(s) com falha</p>}
        {run.report_notes && (
          <div className="mt-3 rounded-r-lg border-l-2 border-brand bg-muted/40 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Observações</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{run.report_notes}</p>
          </div>
        )}
      </div>

      {(defects ?? []).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Defeitos encontrados</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="pb-2 font-medium">ID</th>
                <th className="pb-2 font-medium">Título</th>
                <th className="pb-2 font-medium">Severidade</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {defects.map((d, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-2 font-mono-table text-xs text-muted-foreground">
                    {run.project_code}-B{d.seq}
                  </td>
                  <td className="py-2 font-medium">{d.title}</td>
                  <td className="py-2">
                    <Badge variant={statusBadgeVariant(d.severity)}>{statusLabel(d.severity)}</Badge>
                  </td>
                  <td className="py-2">
                    <Badge variant={statusBadgeVariant(d.status)}>{statusLabel(d.status)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="px-4 py-2 font-medium">ID</th>
              <th className="px-4 py-2 font-medium">Caso de teste</th>
              <th className="px-4 py-2 font-medium">Prioridade</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Duração</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, gi) => (
              <React.Fragment key={gi}>
                <tr className="bg-muted/50">
                  <td colSpan={5} className="px-4 py-2 text-xs font-semibold text-muted-foreground">
                    {g.title} <span className="font-normal">({g.cases.length})</span>
                  </td>
                </tr>
                {g.cases.map((c) => (
                  <React.Fragment key={c.id}>
                    <tr className="border-b border-border">
                      <td className="px-4 py-2 font-mono-table text-xs text-muted-foreground">
                        {run.project_code}-{c.seq}
                      </td>
                      <td className="px-4 py-2 font-medium">{c.title}</td>
                      <td className="px-4 py-2">
                        <Badge variant={statusBadgeVariant(c.priority)}>{statusLabel(c.priority)}</Badge>
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={statusBadgeVariant(c.status)}>{statusLabel(c.status)}</Badge>
                      </td>
                      <td className="px-4 py-2 font-mono-table text-xs text-muted-foreground">
                        {formatDuration(c.duration_seconds)}
                      </td>
                    </tr>
                    {c.comment && (
                      <tr className="border-b border-border">
                        <td />
                        <td colSpan={4} className="px-4 pb-2">
                          <div className="rounded-r-lg border-l-2 border-brand bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                            {stripHtml(c.comment)}
                          </div>
                        </td>
                      </tr>
                    )}
                    <EvidenceRow items={evidencesForCase(c, evidenceIndex)} />
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Gerado pelo Veiser Test — este é um link somente leitura, sem acesso ao restante da conta.
      </p>
    </div>
  );
}

export { PublicReportPage };
