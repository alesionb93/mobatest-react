import * as React from "react";
import type { TestRunCase } from "@/types/test-runs";

export type BulkItemStatus = "pending" | "waiting" | "running" | "passed" | "failed" | "error" | "cancelled";

export interface BulkQueueItemPersisted {
  runCase: TestRunCase;
  status: BulkItemStatus;
  output?: string;
  screenshotBase64?: string | null;
  duration?: number;
  errorMessage?: string;
}

export interface PersistedBulkJob {
  runId: string;
  projectId: string;
  /** jobId do teste ATUAL em andamento no agente — null entre um teste e outro */
  jobId: string | null;
  queue: BulkQueueItemPersisted[];
  currentIndex: number;
  startedAt: number;
}

const STORAGE_KEY = "veiser-test:bulk-automation-job";

interface AutomationJobContextValue {
  bulkJob: PersistedBulkJob | null;
  saveBulkJob: (job: PersistedBulkJob | null) => void;
}

const AutomationJobContext = React.createContext<AutomationJobContextValue | undefined>(undefined);

function loadFromStorage(): PersistedBulkJob | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedBulkJob) : null;
  } catch {
    return null;
  }
}

export function AutomationJobProvider({ children }: { children: React.ReactNode }) {
  const [bulkJob, setBulkJob] = React.useState<PersistedBulkJob | null>(loadFromStorage);

  function saveBulkJob(job: PersistedBulkJob | null) {
    setBulkJob(job);
    try {
      if (job) localStorage.setItem(STORAGE_KEY, JSON.stringify(job));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage indisponível (modo privado, por ex.) — só perde a
      // resiliência a reload, não quebra a execução em si.
    }
  }

  return <AutomationJobContext.Provider value={{ bulkJob, saveBulkJob }}>{children}</AutomationJobContext.Provider>;
}

export function useAutomationJob() {
  const ctx = React.useContext(AutomationJobContext);
  if (!ctx) throw new Error("useAutomationJob precisa estar dentro de <AutomationJobProvider>");
  return ctx;
}
