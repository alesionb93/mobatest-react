export interface MaestroStep {
  label: string;
  status: "passed" | "failed";
  detail?: string;
  friendlyReason?: { title: string; body: string };
}

export interface ParsedMaestroLog {
  device?: string;
  flow?: string;
  steps: MaestroStep[];
  cleanedRaw: string;
  globalFailure?: { title: string; body: string };
}

function extractQuoted(s: string): string | null {
  const m = s.match(/"([^"]+)"/);
  return m ? m[1] : null;
}

/**
 * Traduz os padrões mais comuns de falha do Maestro pra um texto amigável em
 * português. Se não reconhecer o padrão, devolve null — nesse caso o log
 * técnico original continua sendo mostrado, em vez de arriscar uma tradução
 * errada.
 */
export function translateFailureReason(stepLabel: string, detail: string): { title: string; body: string } | null {
  const quoted = extractQuoted(stepLabel) ?? extractQuoted(detail);
  const causesFooter =
    "\n\nPossíveis causas:\n" +
    "- O seletor usado pode estar incorreto — pode haver elementos parecidos, com nomes ou propriedades levemente diferentes.\n" +
    "- O elemento pode estar temporariamente indisponível por causa de carregamento da tela.\n" +
    "- Pode ser uma regressão real que precisa ser corrigida.";
  const hasCausesFooter = /possible causes/i.test(detail);

  // Assert visível, mas não foi encontrado
  if (/assert.*is visible/i.test(stepLabel) && !/not\s*visible/i.test(stepLabel) && /assertion is false/i.test(detail)) {
    const text = quoted ?? "elemento esperado";
    return {
      title: `Falha ao verificar se "${text}" aparece na tela`,
      body:
        `O elemento "${text}" não foi encontrado na tela. Verifique se ele foi exibido corretamente, ` +
        `se o texto mudou, ou se o seletor usado no teste ainda é válido.` +
        (hasCausesFooter ? causesFooter : ""),
    };
  }

  // Assert que NÃO deveria estar visível, mas apareceu
  if (/assert.*not\s*visible/i.test(stepLabel)) {
    const text = quoted ?? "elemento";
    return {
      title: `"${text}" apareceu quando não deveria`,
      body:
        `Esse elemento não deveria estar visível nesse momento do teste, mas apareceu na tela. ` +
        `Pode ser um alerta, popup ou tela inesperada surgindo antes da hora certa.`,
    };
  }

  // Tocar em elemento que não foi encontrado
  if (/^tap on/i.test(stepLabel) && /(not found|no visible|element not)/i.test(detail)) {
    const text = quoted ?? "elemento";
    return {
      title: `Não foi possível tocar em "${text}"`,
      body:
        `O elemento não foi encontrado na tela na hora de tocar nele. Ele pode não ter aparecido a tempo, ` +
        `ter mudado de identificador, ou a tela pode estar diferente do esperado.`,
    };
  }

  // Tempo esgotado esperando algo aparecer
  if (/timed out|timeout/i.test(detail)) {
    return {
      title: "O elemento demorou demais pra aparecer",
      body:
        "O tempo de espera configurado no teste acabou antes do elemento aparecer. " +
        "Pode ser lentidão do app, do dispositivo, ou da conexão de rede — não necessariamente um bug.",
    };
  }

  return null;
}

/**
 * Traduz falhas "globais" — que acontecem antes do teste sequer rodar os
 * passos (problema de infraestrutura: dispositivo, conexão, etc.), em vez
 * de uma asserção específica dentro do fluxo.
 */
export function translateGlobalFailure(raw: string): { title: string; body: string } | null {
  if (/driver did not start up in time/i.test(raw)) {
    return {
      title: "Não consegui conectar ao dispositivo pra rodar o teste",
      body:
        "O Maestro tentou controlar o dispositivo mas não conseguiu conectar a tempo. Isso quase sempre " +
        "acontece quando **já tem outro teste rodando no mesmo dispositivo ao mesmo tempo** (o agente agora " +
        "bloqueia isso, mas se você estiver numa versão mais antiga, confira se não tem outra execução em " +
        "andamento). Também pode ser o emulador/celular temporariamente sem resposta.",
    };
  }

  if (/not enough devices connected|have 0 devices? connected/i.test(raw)) {
    const match = raw.match(/have (\d+) devices? connected/i);
    const connected = match ? match[1] : "0";
    return {
      title: "Nenhum dispositivo conectado",
      body:
        `O Maestro não encontrou dispositivo suficiente pra rodar o teste (${connected} conectado(s)). ` +
        `Confira se o celular/emulador está ligado, com a depuração USB ativa, e aparecendo no comando ` +
        `"adb devices" antes de rodar de novo.`,
    };
  }

  if (/adb:.*(no devices\/emulators found|device .* not found)/i.test(raw)) {
    return {
      title: "Dispositivo não encontrado pelo ADB",
      body:
        "O ADB não conseguiu encontrar o dispositivo configurado. Confira a conexão USB (ou se o emulador " +
        'está aberto) e rode "adb devices" pra confirmar antes de rodar de novo.',
    };
  }

  if (/connection refused|failed to connect/i.test(raw) && /device|emulator|adb/i.test(raw)) {
    return {
      title: "Falha de conexão com o dispositivo",
      body:
        "O Maestro perdeu ou não conseguiu estabelecer conexão com o dispositivo durante o teste. " +
        "Pode ter sido uma queda de USB/Wi-Fi, ou o dispositivo desligou/reiniciou no meio da execução.",
    };
  }

  return null;
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
      let friendlyReason: { title: string; body: string } | undefined;
      if (status === "failed") {
        const detailLines: string[] = [];
        let j = i + 1;
        while (j < lines.length && !STEP_LINE.test(lines[j]) && !lines[j].startsWith("====")) {
          detailLines.push(lines[j]);
          j++;
        }
        detail = detailLines.join("\n").trim() || undefined;
        i = j - 1;
        if (detail) friendlyReason = translateFailureReason(label, detail) ?? undefined;
      }
      steps.push({ label, status, detail, friendlyReason });
    }
    i++;
  }

  const cleanedRaw = raw.trim();
  return { device, flow, steps, cleanedRaw, globalFailure: steps.length === 0 ? translateGlobalFailure(cleanedRaw) ?? undefined : undefined };
}

/**
 * Diz se uma falha foi de infraestrutura (dispositivo desconectado, ADB não
 * achou nada, etc) em vez de uma falha de verdade do teste — usado pra
 * decidir a cor certa (amarelo em vez de vermelho) em quem exibe o
 * resultado.
 */
export function isInfraFailure(output: string | undefined): boolean {
  if (!output) return false;
  const parsed = parseMaestroOutput(output);
  return parsed.steps.length === 0 && !!parsed.globalFailure;
}
