import type { BadgeProps } from "@/components/ui/badge";

export const STATUS_LABELS: Record<string, string> = {
  passed: "Passou",
  failed: "Falhou",
  blocked: "Bloqueado",
  skipped: "Pulado",
  untested: "Não testado",
  pre_existing: "Pré-existente",
  open: "Aberto",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  closed: "Fechado",
  active: "Ativo",
  completed: "Concluído",
  cancelled: "Cancelado",
  draft: "Rascunho",
  deprecated: "Descontinuado",
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
  minor: "Menor",
  normal: "Normal",
  major: "Maior",
  manual: "Manual",
  automated: "Automatizado",
  to_automate: "A automatizar",
  functional: "Funcional",
  regression: "Regressão",
  smoke: "Smoke",
  integration: "Integração",
  e2e: "E2E",
  performance: "Performance",
  security: "Segurança",
  usability: "Usabilidade",
  other: "Outro",
};

export function statusLabel(key: string | null | undefined): string {
  if (!key) return "—";
  return STATUS_LABELS[key] ?? key;
}

const BADGE_VARIANT_MAP: Record<string, NonNullable<BadgeProps["variant"]>> = {
  passed: "success",
  failed: "danger",
  blocked: "warning",
  skipped: "neutral",
  untested: "neutral",
  pre_existing: "info",
  open: "danger",
  in_progress: "warning",
  resolved: "success",
  closed: "neutral",
  active: "info",
  completed: "success",
  cancelled: "danger",
  draft: "neutral",
  deprecated: "neutral",
  low: "neutral",
  medium: "info",
  high: "warning",
  critical: "danger",
  minor: "neutral",
  normal: "info",
  major: "warning",
  manual: "neutral",
  automated: "success",
  to_automate: "warning",
};

export function statusBadgeVariant(key: string | null | undefined): NonNullable<BadgeProps["variant"]> {
  if (!key) return "neutral";
  return BADGE_VARIANT_MAP[key] ?? "neutral";
}

export const PRIORITY_OPTIONS = ["low", "medium", "high", "critical"] as const;
export const SEVERITY_OPTIONS = ["minor", "normal", "major", "critical"] as const;
export const AUTOMATION_OPTIONS = ["manual", "automated", "to_automate"] as const;
export const TEST_TYPE_OPTIONS = [
  "functional",
  "regression",
  "smoke",
  "integration",
  "e2e",
  "performance",
  "security",
  "usability",
  "other",
] as const;

export function toSelectOptions(values: readonly string[]) {
  return values.map((v) => ({ value: v, label: statusLabel(v) }));
}
