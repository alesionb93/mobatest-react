import * as React from "react";

/**
 * O tempo que a pessoa está gastando num caso da execução.
 *
 * - Fechar o drawer (mesmo sem querer) PAUSA: o tempo acumulado fica guardado no navegador, e reabrir o caso segue de
 *   onde parou. O tempo com o drawer fechado não conta.
 * - O que vira "duração" do caso é esse tempo acumulado, e não "agora menos a hora em que o drawer abriu".
 * - Só vale pra um caso que ainda pode receber resultado (não testado, ou em reteste); num caso já testado nada é guardado.
 * - O tempo guardado é de UMA tentativa (`attempt`). Se o resultado daquela tentativa foi gravado por outro caminho
 *   (uma falha da automação, uma execução em lote), o tempo que ficou pra trás é de uma tentativa que já acabou e é
 *   descartado: o reteste seguinte começa do zero, em vez de herdar um tempo velho.
 * - A conta é feita com `Date.now()`, então um navegador que atrasa os timers numa aba em segundo plano não perde tempo.
 */

const PREFIX = "veiser-test:timer:";
/** Uma entrada que ninguém reabriu em 14 dias é de um teste abandonado: é limpa na próxima abertura. */
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

const storageKey = (userId: string, runCaseId: string) => `${PREFIX}${userId}:${runCaseId}`;

/** O tempo guardado pra esta tentativa. Uma entrada de outra tentativa não vale (uma sem `attempt` é de uma versão antiga e vale). */
function readSaved(key: string, attempt: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const saved = JSON.parse(raw) as { elapsedMs?: unknown; attempt?: unknown };
    if (typeof saved.attempt === "number" && saved.attempt !== attempt) return 0;
    return typeof saved.elapsedMs === "number" && Number.isFinite(saved.elapsedMs) && saved.elapsedMs > 0
      ? saved.elapsedMs
      : 0;
  } catch {
    return 0;
  }
}

function writeSaved(key: string, elapsedMs: number, attempt: number) {
  try {
    localStorage.setItem(key, JSON.stringify({ elapsedMs, savedAt: Date.now(), attempt }));
  } catch {
    // Sem espaço ou navegador bloqueando o armazenamento: o relógio segue funcionando, só não sobrevive ao fechar.
  }
}

function removeSaved(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // idem
  }
}

function pruneOld() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      let savedAt = 0;
      try {
        savedAt = Number((JSON.parse(localStorage.getItem(key) ?? "{}") as { savedAt?: unknown }).savedAt);
      } catch {
        // entrada corrompida: cai no teste abaixo e é removida
      }
      if (!Number.isFinite(savedAt) || Date.now() - savedAt > MAX_AGE_MS) localStorage.removeItem(key);
    }
  } catch {
    // idem
  }
}

interface UseCaseTimerArgs {
  open: boolean;
  runCaseId: string | null;
  userId: string | null;
  /** O caso ainda pode receber resultado (não testado ou em reteste)? Só então o tempo é guardado e retomado. */
  persist: boolean;
  /**
   * Qual tentativa está em andamento: 0 é a primeira; cada reteste concluído soma 1. Quem chama calcula (ver o drawer).
   * É o que impede um tempo velho de ser retomado numa tentativa nova.
   */
  attempt: number;
}

export function useCaseTimer({ open, runCaseId, userId, persist, attempt }: UseCaseTimerArgs) {
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const startRef = React.useRef(0); // 0 = ainda não abriu
  const carryRef = React.useRef(0);
  const keyRef = React.useRef<string | null>(null);
  const persistRef = React.useRef(persist);
  const attemptRef = React.useRef(attempt);
  const restoredRef = React.useRef(false);
  const suspendedRef = React.useRef(false);

  const totalMs = React.useCallback(
    () => (startRef.current === 0 ? carryRef.current : carryRef.current + (Date.now() - startRef.current)),
    []
  );

  // Abrir, fechar ou trocar de caso. Ao fechar, o cleanup guarda o tempo acumulado (é a pausa).
  React.useEffect(() => {
    if (!open || !runCaseId || !userId) return;
    const key = storageKey(userId, runCaseId);
    keyRef.current = key;
    startRef.current = Date.now();
    carryRef.current = 0;
    restoredRef.current = false;
    suspendedRef.current = false;
    setElapsedSeconds(0);
    pruneOld();

    const save = () => {
      if (persistRef.current && !suspendedRef.current) writeSaved(key, totalMs(), attemptRef.current);
    };
    const tick = () => {
      setElapsedSeconds(Math.floor(totalMs() / 1000));
      save();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") save();
    };
    const interval = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", save);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", save);
      save();
      keyRef.current = null;
    };
  }, [open, runCaseId, userId, totalMs]);

  // O caso passou a aceitar resultado (terminou de carregar e está não testado, ou entrou em reteste): retoma de onde
  // parou. Roda DEPOIS do efeito acima (declarado antes), inclusive quando o mesmo caso é reaberto.
  React.useEffect(() => {
    persistRef.current = persist;
    attemptRef.current = attempt;
    const key = keyRef.current;
    if (!persist || !key) return;
    suspendedRef.current = false;
    if (restoredRef.current) return;
    restoredRef.current = true;
    const saved = readSaved(key, attempt);
    if (saved > 0) {
      carryRef.current = saved;
      setElapsedSeconds(Math.floor(totalMs() / 1000));
    }
  }, [open, userId, runCaseId, persist, attempt, totalMs]);

  /** Os segundos a gravar como duração do caso. */
  const getElapsedSeconds = React.useCallback(() => Math.round(totalMs() / 1000), [totalMs]);

  /** Resultado marcado: apaga o que estava guardado e zera, pra a próxima tentativa começar do zero. */
  const reset = React.useCallback(() => {
    const key = keyRef.current;
    if (key) removeSaved(key);
    carryRef.current = 0;
    startRef.current = Date.now();
    suspendedRef.current = true;
    setElapsedSeconds(0);
  }, []);

  /**
   * "Testar novamente": o relógio recomeça (o tempo gasto só olhando o resultado antigo não conta), mas um reteste que
   * já estava em andamento e foi fechado sem querer é RETOMADO do que estava guardado, em vez de apagado.
   */
  const restart = React.useCallback(() => {
    carryRef.current = 0;
    startRef.current = Date.now();
    restoredRef.current = false;
    suspendedRef.current = false;
    setElapsedSeconds(0);
  }, []);

  return { elapsedSeconds, getElapsedSeconds, reset, restart };
}

/**
 * A tentativa em andamento de um caso: 0 é a primeira; depois de um resultado, a tentativa em andamento é um reteste
 * (1), e cada reteste concluído soma 1 em `retest_count`.
 */
export function currentAttempt(rc: { status: string; retest_count: number }): number {
  return rc.retest_count + (rc.status === "untested" ? 0 : 1);
}
