import * as React from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Play, X } from "lucide-react";
import DOMPurify from "dompurify";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/format";
import { cn, richTextClasses } from "@/lib/utils";
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
/** O "template" de um teste (descrição, pré-requisitos, passos, resultado esperado), vindo de /api/report-cases. */
interface CaseTemplate {
  testRunCaseId: string;
  testCaseId: string;
  description: string | null;
  preconditions: string | null;
  reproSteps: string | null;
  expectedResult: string | null;
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

/**
 * Os textos dos testes são HTML escrito por gente da empresa (o editor do sistema). Numa página
 * PÚBLICA nada disso vai pra tela cru: passa pelo DOMPurify, que tira script, atributos de evento
 * (onerror...), links "javascript:" e o que mais for perigoso.
 */
let purifyConfigured = false;
function sanitizeHtml(html: string | null | undefined): string {
  const value = (html ?? "").trim();
  if (!value) return "";
  if (!purifyConfigured) {
    purifyConfigured = true;
    // Links dos textos abrem em aba nova, sem dar acesso à página de origem.
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node instanceof Element && node.tagName === "A") {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    });
  }
  const clean = DOMPurify.sanitize(value, { USE_PROFILES: { html: true } }).trim();
  // O editor grava "<p></p>" quando o campo fica vazio: sem texto nem imagem, conta como vazio.
  return stripHtml(clean).trim() === "" && !/<(img|hr|video)\b/i.test(clean) ? "" : clean;
}

/** Conteúdo dos testes por id (do caso na execução E do caso de teste): são UUIDs, não se confundem. */
function indexTemplates(cases: CaseTemplate[]) {
  const index = new Map<string, CaseTemplate>();
  cases.forEach((t) => {
    index.set(t.testRunCaseId, t);
    index.set(t.testCaseId, t);
  });
  return index;
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

        {!loading && data && token && <ReportContent data={data} evidences={evidences} token={token} />}
      </div>
    </div>
  );
}

/** Coluna "Evidências": só um botão — nenhuma imagem é baixada até alguém querer ver. */
function EvidenceCell({
  items,
  onOpen,
}: {
  items: PublicEvidence[];
  onOpen: (items: PublicEvidence[], trigger: HTMLElement) => void;
}) {
  if (items.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <button
      type="button"
      title="Abrir as evidências deste caso"
      aria-haspopup="dialog"
      onClick={(e) => onOpen(items, e.currentTarget)}
      className="cursor-pointer text-xs font-medium text-brand hover:underline"
    >
      Ver ({items.length})
    </button>
  );
}

/**
 * Galeria das evidências de um caso: imagem/vídeo grande, contador, setas (← →), miniaturas pra
 * pular e link pro original. Esc ou clique fora fecha. Só carrega os arquivos quando abre.
 */
function EvidenceGallery({
  items,
  title,
  trigger,
  onClose,
}: {
  items: PublicEvidence[];
  title: string;
  trigger: HTMLElement;
  onClose: () => void;
}) {
  const [index, setIndex] = React.useState(0);
  const [failed, setFailed] = React.useState<ReadonlySet<string>>(new Set());
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const last = items.length - 1;
  const current = items[index];
  const isVideo = current.contentType.startsWith("video/");

  const go = React.useCallback((delta: number) => setIndex((i) => Math.min(last, Math.max(0, i + delta))), [last]);

  React.useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && !(e.target instanceof HTMLVideoElement)) {
        // Com o foco no vídeo, as setas pertencem ao player (avançar/voltar o vídeo).
        e.preventDefault();
        go(e.key === "ArrowRight" ? 1 : -1);
      } else if (e.key === "Tab" && dialogRef.current) {
        // O foco fica preso na galeria enquanto ela está aberta.
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], video[controls]")
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const lastEl = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (!dialogRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && (active === first || active === dialogRef.current)) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && active === lastEl) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (trigger.isConnected) trigger.focus();
    };
  }, [trigger, onClose, go]);

  const markFailed = (id: string) => setFailed((prev) => new Set(prev).add(id));
  const navButton =
    "absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 disabled:pointer-events-none disabled:opacity-30";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Evidências: ${title}`}
        tabIndex={-1}
        className="flex max-h-full w-full max-w-4xl flex-col gap-3 rounded-xl border border-white/10 bg-neutral-950 p-3 text-white outline-none sm:p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{title}</p>
            <p className="truncate text-xs text-white/60">
              {index + 1} de {items.length} · {current.fileName} · {formatBytes(current.fileSize)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative flex min-h-[200px] flex-1 items-center justify-center overflow-hidden">
          <button type="button" aria-label="Anterior" disabled={index === 0} onClick={() => go(-1)} className={`${navButton} left-1`}>
            <ChevronLeft size={20} />
          </button>
          {failed.has(current.id) ? (
            <p className="max-w-sm px-12 text-center text-sm text-white/70">
              Não foi possível carregar este arquivo. Os links são temporários (1 hora): atualize a página e tente
              de novo.
            </p>
          ) : isVideo ? (
            <video
              key={current.id}
              src={current.url}
              controls
              preload="metadata"
              playsInline
              onError={() => markFailed(current.id)}
              className="max-h-[65vh] max-w-full rounded-md bg-black"
            />
          ) : (
            <img
              key={current.id}
              src={current.url}
              alt={current.fileName}
              onError={() => markFailed(current.id)}
              className="max-h-[65vh] max-w-full rounded-md object-contain"
            />
          )}
          <button type="button" aria-label="Próxima" disabled={index === last} onClick={() => go(1)} className={`${navButton} right-1`}>
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1">
            {items.map((e, i) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setIndex(i)}
                title={e.fileName}
                aria-label={`Ir para a evidência ${i + 1} de ${items.length}`}
                aria-current={i === index}
                className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-md border bg-white/5 ${
                  i === index ? "border-brand ring-2 ring-brand" : "border-white/15 opacity-70 hover:opacity-100"
                }`}
              >
                {e.contentType.startsWith("video/") ? (
                  <span className="flex h-full w-full items-center justify-center text-white/80">
                    <Play size={16} />
                  </span>
                ) : (
                  <img src={e.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
              </button>
            ))}
          </div>
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-white/20 px-2.5 py-1.5 text-xs text-white/90 hover:bg-white/10"
          >
            <ExternalLink size={13} />
            Abrir original
          </a>
        </div>
      </div>
    </div>
  );
}

function TemplateBlock({ label, html, emptyLabel }: { label: string; html: string | null; emptyLabel: string }) {
  const clean = React.useMemo(() => sanitizeHtml(html), [html]);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      {clean ? (
        <div className={cn("text-sm text-foreground [&_a]:text-brand [&_a]:underline", richTextClasses)}
          dangerouslySetInnerHTML={{ __html: clean }} />
      ) : (
        <p className="text-sm text-muted-foreground italic">{emptyLabel}</p>
      )}
    </div>
  );
}

type TemplatesStatus = "idle" | "loading" | "ready" | "error";

/** A linha que abre embaixo do título: o template do teste, na mesma ordem do drawer do sistema. */
function TemplateRow({
  id,
  status,
  template,
  onRetry,
}: {
  id: string;
  status: TemplatesStatus;
  template: CaseTemplate | undefined;
  onRetry: () => void;
}) {
  return (
    <tr id={id} className="border-b border-border">
      <td />
      <td colSpan={5} className="px-4 pb-4 pt-1">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
          {status === "error" ? (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>Não foi possível carregar o teste.</span>
              <button type="button" onClick={onRetry} className="cursor-pointer text-xs font-medium text-brand hover:underline">
                Tentar de novo
              </button>
            </div>
          ) : !template ? (
            <p className="text-sm text-muted-foreground">
              {status === "ready" ? "O conteúdo deste teste não está disponível." : "Carregando o teste..."}
            </p>
          ) : (
            <>
              <TemplateBlock label="Descrição" html={template.description} emptyLabel="Sem descrição." />
              <TemplateBlock label="Pré-requisitos" html={template.preconditions} emptyLabel="Não definido." />
              <TemplateBlock label="Passos para reprodução" html={template.reproSteps} emptyLabel="Não definido." />
              <TemplateBlock label="Resultado esperado" html={template.expectedResult} emptyLabel="Não definido." />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

/** O endereço da barra aponta pro último teste aberto (dá pra copiar e mandar). Preserva o state do router. */
function setCaseHash(seq: number | null) {
  const base = window.location.pathname + window.location.search;
  window.history.replaceState(window.history.state, "", seq === null ? base : `${base}#caso-${seq}`);
}

function ReportContent({ data, evidences, token }: { data: PublicReportData; evidences: PublicEvidence[]; token: string }) {
  const { run, cases, suites, defects } = data;
  const allCases = React.useMemo(() => cases ?? [], [cases]);
  // Abre já com o teste do endereço (#caso-154), se houver.
  const [expanded, setExpanded] = React.useState<ReadonlySet<string>>(() => {
    const match = /^#caso-(\d+)$/.exec(window.location.hash);
    const target = match ? (cases ?? []).find((c) => c.seq === Number(match[1])) : undefined;
    return new Set(target ? [target.id] : []);
  });
  const [templates, setTemplates] = React.useState<{ status: TemplatesStatus; byKey: Map<string, CaseTemplate> }>({
    status: "idle",
    byKey: new Map(),
  });
  const templatesRequested = React.useRef(false);

  // O conteúdo de TODOS os testes vem num pedido só, no primeiro clique, e fica guardado: a página abre
  // tão leve quanto antes, e as aberturas seguintes são instantâneas.
  const loadTemplates = React.useCallback(async () => {
    if (templatesRequested.current) return;
    templatesRequested.current = true;
    setTemplates((t) => ({ ...t, status: "loading" }));
    try {
      const response = await fetch(`/api/report-cases?token=${encodeURIComponent(token)}`);
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { cases?: CaseTemplate[] };
      if (!Array.isArray(body.cases)) throw new Error("resposta inesperada");
      setTemplates({ status: "ready", byKey: indexTemplates(body.cases) });
    } catch {
      templatesRequested.current = false; // deixa "Tentar de novo" pedir outra vez
      setTemplates((t) => ({ ...t, status: "error" }));
    }
  }, [token]);

  // Link direto: se a página abriu com #caso-N, busca o conteúdo e rola até o teste.
  React.useEffect(() => {
    if (expanded.size === 0) return;
    void loadTemplates();
    const match = /^#caso-(\d+)$/.exec(window.location.hash);
    if (match) requestAnimationFrame(() => document.getElementById(`caso-${match[1]}`)?.scrollIntoView({ block: "start" }));
    // Só na abertura da página: depois disso quem decide o que abre são os cliques.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleCase(c: PublicRunCase) {
    const opening = !expanded.has(c.id);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (opening) next.add(c.id);
      else next.delete(c.id);
      return next;
    });
    if (opening) {
      void loadTemplates();
      setCaseHash(c.seq);
    } else if (window.location.hash === `#caso-${c.seq}`) {
      setCaseHash(null);
    }
  }
  const allExpanded = allCases.length > 0 && allCases.every((c) => expanded.has(c.id));
  function toggleAll() {
    setCaseHash(null);
    if (allExpanded) {
      setExpanded(new Set());
    } else {
      setExpanded(new Set(allCases.map((c) => c.id)));
      void loadTemplates();
    }
  }
  const evidenceIndex = React.useMemo(() => indexEvidences(evidences), [evidences]);
  const [gallery, setGallery] = React.useState<{ items: PublicEvidence[]; title: string; trigger: HTMLElement } | null>(null);
  const closeGallery = React.useCallback(() => setGallery(null), []);
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

      {allCases.length > 0 && (
        <div className="-mb-3 flex justify-end">
          <button type="button" onClick={toggleAll} className="cursor-pointer text-xs font-medium text-brand hover:underline">
            {allExpanded ? "Recolher tudo" : "Expandir tudo"}
          </button>
        </div>
      )}
      <div className="rounded-xl border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="px-4 py-2 font-medium">ID</th>
              <th className="px-4 py-2 font-medium">Caso de teste</th>
              <th className="px-4 py-2 font-medium">Prioridade</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Duração</th>
              <th className="px-4 py-2 font-medium">Evidências</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, gi) => (
              <React.Fragment key={gi}>
                <tr className="bg-muted/50">
                  <td colSpan={6} className="px-4 py-2 text-xs font-semibold text-muted-foreground">
                    {g.title} <span className="font-normal">({g.cases.length})</span>
                  </td>
                </tr>
                {g.cases.map((c) => {
                  const isOpen = expanded.has(c.id);
                  return (
                  <React.Fragment key={c.id}>
                    <tr id={`caso-${c.seq}`} className="scroll-mt-4 border-b border-border">
                      <td className="px-4 py-2 font-mono-table text-xs text-muted-foreground">
                        {run.project_code}-{c.seq}
                      </td>
                      <td className="px-4 py-2 font-medium">
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          aria-controls={`caso-${c.seq}-teste`}
                          onClick={() => toggleCase(c)}
                          className="group flex w-full cursor-pointer items-start gap-1.5 text-left"
                        >
                          <ChevronRight
                            size={14}
                            aria-hidden
                            className={cn("mt-1 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")}
                          />
                          <span className="group-hover:underline">{c.title}</span>
                        </button>
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={statusBadgeVariant(c.priority)}>{statusLabel(c.priority)}</Badge>
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={statusBadgeVariant(c.status)}>{statusLabel(c.status)}</Badge>
                      </td>
                      <td className="px-4 py-2 font-mono-table text-xs text-muted-foreground">
                        {formatDuration(c.duration_seconds)}
                      </td>
                      <td className="px-4 py-2 align-top">
                        <EvidenceCell
                          items={evidencesForCase(c, evidenceIndex)}
                          onOpen={(items, trigger) =>
                            setGallery({ items, trigger, title: `${run.project_code}-${c.seq} · ${c.title}` })
                          }
                        />
                      </td>
                    </tr>
                    {c.comment && (
                      <tr className="border-b border-border">
                        <td />
                        <td colSpan={5} className="px-4 pb-2">
                          <div className="rounded-r-lg border-l-2 border-brand bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                            {stripHtml(c.comment)}
                          </div>
                        </td>
                      </tr>
                    )}
                    {isOpen && (
                      <TemplateRow
                        id={`caso-${c.seq}-teste`}
                        status={templates.status}
                        template={templates.byKey.get(c.id) ?? templates.byKey.get(c.case_id)}
                        onRetry={() => void loadTemplates()}
                      />
                    )}
                  </React.Fragment>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {gallery && <EvidenceGallery {...gallery} onClose={closeGallery} />}

      <p className="text-center text-xs text-muted-foreground">
        Gerado pelo Veiser Test — este é um link somente leitura, sem acesso ao restante da conta.
      </p>
    </div>
  );
}

export { PublicReportPage };
