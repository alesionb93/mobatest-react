import type { TestSuite } from "@/types/test-cases";
import type { TestRunCase, Profile } from "@/types/test-runs";

export interface SuiteGroup {
  key: string;
  title: string;
  depth: number;
  cases: TestRunCase[];
}

function buildSuiteOrder(suites: TestSuite[]) {
  const byParent: Record<string, TestSuite[]> = {};
  suites.forEach((s) => {
    const key = s.parent_suite_id ?? "root";
    (byParent[key] = byParent[key] ?? []).push(s);
  });
  Object.values(byParent).forEach((arr) => arr.sort((a, b) => a.position - b.position));

  const order: { id: string; title: string; depth: number }[] = [];
  function walk(parentId: string | null, depth: number) {
    (byParent[parentId ?? "root"] ?? []).forEach((s) => {
      order.push({ id: s.id, title: s.title, depth });
      walk(s.id, depth + 1);
    });
  }
  walk(null, 0);
  return order;
}

export function groupRunCasesBySuite(runCases: TestRunCase[], suites: TestSuite[]): SuiteGroup[] {
  const suiteOrder = buildSuiteOrder(suites);
  const bySuite: Record<string, TestRunCase[]> = {};
  runCases.forEach((rc) => {
    const key = rc.test_cases.suite_id ?? "none";
    (bySuite[key] = bySuite[key] ?? []).push(rc);
  });
  Object.values(bySuite).forEach((arr) => arr.sort((a, b) => a.test_cases.seq - b.test_cases.seq));

  const groups: SuiteGroup[] = [];
  suiteOrder.forEach((s) => {
    if (bySuite[s.id]) groups.push({ key: s.id, title: s.title, depth: s.depth, cases: bySuite[s.id] });
  });
  if (bySuite["none"]) groups.push({ key: "none", title: "Sem suíte", depth: 0, cases: bySuite["none"] });
  return groups;
}

export function flattenGroups(groups: SuiteGroup[]) {
  return groups.flatMap((g) => g.cases);
}

export function profileName(
  userId: string | null | undefined,
  profilesMap: Record<string, Profile>,
  currentUserId?: string
) {
  if (!userId) return "Não atribuído";
  if (userId === currentUserId) return profilesMap[userId]?.full_name || "Você";
  return profilesMap[userId]?.full_name || "Outro membro";
}

export function formatDuration(totalSeconds: number | null | undefined) {
  if (!totalSeconds || totalSeconds <= 0) return "—";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatElapsed(createdAt: string, completedAt: string | null) {
  const start = new Date(createdAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  return formatDuration(Math.round((end - start) / 1000));
}

export function formatMMSS(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export function stripHtml(html: string | null | undefined) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent ?? "";
}
