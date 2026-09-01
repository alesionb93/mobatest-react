export interface MaestroStep {
  label: string;
  status: "passed" | "failed";
  detail?: string;
}

export interface ParsedMaestroLog {
  device?: string;
  flow?: string;
  steps: MaestroStep[];
  cleanedRaw: string;
}

const STEP_LINE = /^(.*?)\.\.\.\s*(COMPLETED|FAILED)\s*$/;

export function parseMaestroOutput(raw: string): ParsedMaestroLog {
  const lines = raw.split("\n").map((l) => l.trimEnd());

  const deviceMatch = lines.find((l) => /^Running on /.test(l));
  const device = deviceMatch?.replace(/^Running on /, "").trim();

  const flowMatch = lines.find((l) => /^\s*>\s*Flow\s+/.test(l));
  const flow = flowMatch?.replace(/^\s*>\s*Flow\s+/, "").trim();

  const steps: MaestroStep[] = [];
  let i = 0;
  while (i < lines.length) {
    const m = STEP_LINE.exec(lines[i]);
    if (m) {
      const label = m[1].trim();
      const status: "passed" | "failed" = m[2] === "COMPLETED" ? "passed" : "failed";
      let detail: string | undefined;
      if (status === "failed") {
        const detailLines: string[] = [];
        let j = i + 1;
        while (j < lines.length && !STEP_LINE.test(lines[j]) && !lines[j].startsWith("====")) {
          detailLines.push(lines[j]);
          j++;
        }
        detail = detailLines.join("\n").trim() || undefined;
        i = j - 1;
      }
      steps.push({ label, status, detail });
    }
    i++;
  }

  return { device, flow, steps, cleanedRaw: raw.trim() };
}
