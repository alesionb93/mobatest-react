// ============================================================
// Veiser Test — Agente local do Maestro
// ============================================================
// O que isso faz: cria uma "portinha" local (http://127.0.0.1:PORTA)
// que a tela do Veiser Test, aberta no navegador, consegue chamar. Quando
// chamada, ele roda de verdade o comando "maestro test" na máquina do
// usuário, espera o resultado, e devolve pro navegador se passou ou
// falhou — que aí marca o status certo direto na execução.
//
// COMO USAR:
//   1) Edite config.json com o caminho da pasta raiz dos seus .yaml.
//   2) Rode: node agent.js
//   3) Deixe essa janela do terminal aberta enquanto usar o botão
//      "Executar automatizado" no Veiser Test.

const http = require('http');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const CONFIG_PATH = path.join(__dirname, 'config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`\n❌ Não encontrei o arquivo config.json em ${CONFIG_PATH}`);
    console.error('   Copie o config.example.json para config.json e edite o "baseFolder".\n');
    process.exit(1);
  }
  const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
  const config = JSON.parse(raw);
  if (!config.baseFolder || !fs.existsSync(config.baseFolder)) {
    console.error(`\n❌ O "baseFolder" configurado não existe: ${config.baseFolder}`);
    console.error('   Corrija o caminho no config.json e rode de novo.\n');
    process.exit(1);
  }
  return config;
}

const config = loadConfig();
// Variável de ambiente tem prioridade sobre o config.json — útil se o time
// quiser padronizar o caminho via script de login/política corporativa,
// em vez de cada QA editar o arquivo manualmente.
if (process.env.MAESTRO_BASE_FOLDER) {
  config.baseFolder = process.env.MAESTRO_BASE_FOLDER;
  if (!fs.existsSync(config.baseFolder)) {
    console.error(`\n❌ MAESTRO_BASE_FOLDER aponta para um caminho que não existe: ${config.baseFolder}\n`);
    process.exit(1);
  }
}
const PORT = config.port || 4545;
// allowedOrigin pode ser um texto único ("http://localhost:5173") ou uma
// lista (["https://mobatest.vercel.app", "https://mobatest-stg.vercel.app"])
// — útil pra liberar produção e homologação ao mesmo tempo.
const ALLOWED_ORIGINS = Array.isArray(config.allowedOrigin)
  ? config.allowedOrigin
  : [config.allowedOrigin || 'http://localhost:5173'];

function setCors(req, res) {
  const origin = req.headers.origin;
  // CORS exige devolver exatamente a origem que fez a chamada (não dá pra
  // simplesmente listar várias no header) — por isso conferimos se ela está
  // na lista liberada antes de ecoar de volta.
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// Impede tentativas de escapar da pasta configurada (ex: "../../../etc")
function resolveSafeScriptPath(scriptPath) {
  const full = path.resolve(config.baseFolder, scriptPath);
  if (!full.startsWith(path.resolve(config.baseFolder))) {
    throw new Error('Caminho de script inválido.');
  }
  if (!fs.existsSync(full)) {
    throw new Error(`Arquivo não encontrado: ${full}`);
  }
  return full;
}

// Varre a pasta de testes em busca de arquivos .yaml, pra alimentar a lista
// de escolha no Veiser Test (em vez do QA digitar o caminho na mão). Ignora
// arquivos que começam com "_" (ex: _TEMPLATE.yaml).
function collectYamlFiles(rootAbs, rootRel) {
  let results = [];
  let entries;
  try {
    entries = fs.readdirSync(rootAbs, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const abs = path.join(rootAbs, entry.name);
    const rel = rootRel ? `${rootRel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results = results.concat(collectYamlFiles(abs, rel));
    } else if (entry.isFile() && /\.ya?ml$/i.test(entry.name) && !entry.name.startsWith('_')) {
      results.push(rel);
    }
  }
  return results;
}

function listAvailableScripts() {
  // Se existir uma subpasta "flows", lista só o que está lá dentro (é onde
  // ficam os testes de verdade — subflows/ e testdata/ são auxiliares,
  // não fluxos executáveis como caso de teste). Pode ser sobrescrito via
  // "scriptsRoot" no config.json.
  const scriptsRootRel =
    config.scriptsRoot || (fs.existsSync(path.join(config.baseFolder, 'flows')) ? 'flows' : '.');
  const scriptsRootAbs = path.resolve(config.baseFolder, scriptsRootRel);
  const rootRel = scriptsRootRel === '.' ? '' : scriptsRootRel;
  return collectYamlFiles(scriptsRootAbs, rootRel).sort();
}

// Acha o .png mais recente dentro da pasta de debug do Maestro — é o print
// mais próximo do momento da falha (o Maestro tira prints a cada passo).
function findLatestScreenshot(dir) {
  let latestPath = null;
  let latestTime = 0;
  function walk(current) {
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (/\.png$/i.test(entry.name)) {
        const stat = fs.statSync(full);
        if (stat.mtimeMs > latestTime) {
          latestTime = stat.mtimeMs;
          latestPath = full;
        }
      }
    }
  }
  walk(dir);
  return latestPath;
}

// Remove ruído técnico irrelevante pra quem só quer entender o que aconteceu:
// avisos de depreciação da JVM, e a seção de "debug output" (já tratamos os
// prints separadamente, e a pasta é temporária e já foi apagada).
function cleanMaestroOutput(raw) {
  return raw
    .split('\n')
    .filter((line) => !line.startsWith('WARNING:'))
    .join('\n')
    .split('==== Debug output (logs & screenshots) ====')[0]
    .trim();
}

// Registro de jobs em memória: permite que o navegador CONSULTE o andamento
// de um teste (GET /jobs/:id) em vez de precisar ficar numa única chamada
// esperando a resposta. Isso é o que permite reconectar numa execução que já
// estava rodando, mesmo se a aba do navegador recarregar no meio do caminho
// — o teste continua rodando aqui no agente de qualquer forma, e a consulta
// só "olha" o que já está acontecendo.
const jobs = new Map();
const JOB_TTL_MS = 30 * 60 * 1000; // limpa jobs terminados depois de 30min

function createJob(scriptPath) {
  const jobId = crypto.randomUUID();
  jobs.set(jobId, { status: 'running', scriptPath, startedAt: Date.now(), result: null, process: null });
  return jobId;
}

function finishJob(jobId, result) {
  const job = jobs.get(jobId);
  if (!job) return;
  // Se já foi cancelado explicitamente, não deixa um resultado tardio
  // (o processo ainda terminando de morrer) sobrescrever isso.
  if (job.status === 'cancelled') return;
  job.status = result.status;
  job.result = result;
  setTimeout(() => jobs.delete(jobId), JOB_TTL_MS).unref?.();
}

// No Windows, o comando roda dentro de um cmd.exe (por causa do chcp) — matar
// só esse processo não mata o Java/Maestro que ele abriu por baixo. "taskkill
// /T" mata a árvore inteira de processos, de verdade.
function killProcessTree(child) {
  if (!child || !child.pid) return;
  if (process.platform === 'win32') {
    exec(`taskkill /pid ${child.pid} /T /F`, () => {});
  } else {
    try {
      child.kill('SIGKILL');
    } catch {
      // já deve ter morrido sozinho
    }
  }
}


// ============================================================
// Espelho do dispositivo (scrcpy), aberto e posicionado do lado do
// navegador automaticamente — evita ter que abrir/arrastar a janela na mão
// toda vez. O scrcpy já roda no PC (não no celular); ele só recebe a tela
// via ADB e mostra numa janela nativa — o agente só decide ONDE essa janela
// aparece, usando as próprias opções de posição/tamanho do scrcpy.
let mirrorProcess = null;

// Descobre onde está a janela em primeiro plano (presumivelmente o navegador,
// já que o QA acabou de clicar no botão nela) usando a API do Windows — assim
// o scrcpy abre do lado de ONDE o navegador realmente está, e não numa
// posição fixa que só funciona se o navegador estiver sempre no mesmo monitor.
function getForegroundWindowRect() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(null);
      return;
    }
    const scriptPath = path.join(os.tmpdir(), 'veiser-test-foreground-window.ps1');
    const script = [
      'Add-Type @"',
      'using System;',
      'using System.Runtime.InteropServices;',
      'public class VeiserTestWin32 {',
      '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
      '  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);',
      '  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }',
      '}',
      '"@',
      '$hwnd = [VeiserTestWin32]::GetForegroundWindow()',
      '$rect = New-Object VeiserTestWin32+RECT',
      '[VeiserTestWin32]::GetWindowRect($hwnd, [ref]$rect) | Out-Null',
      'Write-Output "$($rect.Left),$($rect.Top),$($rect.Right),$($rect.Bottom)"',
    ].join('\n');
    try {
      fs.writeFileSync(scriptPath, script, 'utf-8');
    } catch {
      resolve(null);
      return;
    }
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, { timeout: 5000 }, (err, stdout) => {
      fs.unlink(scriptPath, () => {});
      if (err) {
        resolve(null);
        return;
      }
      const parts = String(stdout).trim().split(',').map(Number);
      if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
        resolve(null);
        return;
      }
      const [left, top, right, bottom] = parts;
      resolve({ left, top, right, bottom });
    });
  });
}

function getScrcpyConfig() {
  const cfg = config.scrcpy || {};
  return {
    command: cfg.path || 'scrcpy',
    windowTitle: cfg.windowTitle || 'Veiser Test — Espelho do dispositivo',
    autoPosition: cfg.autoPosition !== false,
    gap: cfg.gap ?? 12,
    windowX: cfg.windowX ?? 980,
    windowY: cfg.windowY ?? 60,
    windowWidth: cfg.windowWidth ?? 380,
    windowHeight: cfg.windowHeight ?? 780,
    alwaysOnTop: cfg.alwaysOnTop !== false,
    extraArgs: Array.isArray(cfg.extraArgs) ? cfg.extraArgs : [],
  };
}

function isMirrorRunning() {
  return !!mirrorProcess && mirrorProcess.exitCode === null && !mirrorProcess.killed;
}

async function openMirror(explicitPos) {
  if (isMirrorRunning()) {
    return { ok: true, alreadyOpen: true };
  }
  const sc = getScrcpyConfig();

  // Prioridade: 1) posição calculada pelo próprio navegador (a mais precisa
  // que existe, já que ele sabe exatamente onde o modal está na tela);
  // 2) detecção automática via janela em primeiro plano; 3) posição fixa.
  let windowX = sc.windowX;
  let windowY = sc.windowY;
  if (explicitPos) {
    windowX = explicitPos.x;
    windowY = explicitPos.y;
  } else if (sc.autoPosition) {
    const rect = await getForegroundWindowRect();
    if (rect) {
      windowX = rect.right + sc.gap;
      windowY = rect.top;
    }
  }

  return new Promise((resolve) => {
    const args = [
      '--window-title', sc.windowTitle,
      '--window-x', String(windowX),
      '--window-y', String(windowY),
      '--window-width', String(sc.windowWidth),
      '--window-height', String(sc.windowHeight),
      ...(sc.alwaysOnTop ? ['--always-on-top'] : []),
      ...sc.extraArgs,
    ];

    let settled = false;
    const child = spawn(sc.command, args, { stdio: 'ignore' });
    mirrorProcess = child;

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      mirrorProcess = null;
      resolve({ ok: false, error: `Não consegui abrir o scrcpy ("${sc.command}"): ${err.message}. Ele está instalado e no PATH?` });
    });

    // Se o processo não morreu logo de cara, considera que abriu com sucesso
    // (scrcpy não tem um jeito simples de avisar "pronto" por outro canal).
    setTimeout(() => {
      if (settled) return;
      settled = true;
      if (isMirrorRunning()) {
        resolve({ ok: true, alreadyOpen: false });
      } else {
        resolve({ ok: false, error: 'O scrcpy fechou logo depois de abrir — confira se o dispositivo está conectado (rode "adb devices" pra checar).' });
      }
    }, 1500);

    child.on('exit', () => {
      if (mirrorProcess === child) mirrorProcess = null;
    });
  });
}

function closeMirror() {
  if (isMirrorRunning()) mirrorProcess.kill();
  mirrorProcess = null;
}

function runMaestro(scriptFullPath, onChildStarted) {
  return new Promise((resolve) => {
    const start = Date.now();
    // Pasta temporária só pra essa rodada — pede pro próprio Maestro salvar
    // ali os logs e prints de cada passo (--debug-output é um recurso nativo
    // do Maestro, não é nada que o agente inventa).
    const debugDir = path.join(os.tmpdir(), 'mobatest-maestro', String(Date.now()));
    try {
      fs.mkdirSync(debugDir, { recursive: true });
    } catch {
      // se não conseguir criar, segue sem debug-output — só perde o print
    }
    // No Windows, o cmd.exe às vezes converte o comando pra uma página de
    // código antiga antes de rodar, e caracteres fora dela (emoji, alguns
    // acentos) viram "?" literal — o que quebra o caminho do arquivo. Forçar
    // UTF-8 (chcp 65001) nessa sessão evita isso.
    const chcpPrefix = process.platform === 'win32' ? 'chcp 65001 >NUL && ' : '';
    const command = `${chcpPrefix}maestro test --debug-output "${debugDir}" "${scriptFullPath}"`;

    const child = exec(
      command,
      { timeout: config.timeoutMs || 10 * 60 * 1000, maxBuffer: 20 * 1024 * 1024, cwd: config.baseFolder },
      (error, stdout, stderr) => {
        const duration = Math.round((Date.now() - start) / 1000);
        const status = error ? 'failed' : 'passed';
        let output = (stdout || '') + (stderr || '');

        // No Windows, matar um processo Java abruptamente (por ter estourado
        // o tempo limite) não dá chance dele "descarregar" o que já tinha
        // escrito — o log acumulado se perde. Detecta esse caso específico
        // (error.killed é setado pelo Node quando o timeout é quem matou o
        // processo) e sintetiza uma mensagem útil, em vez de devolver vazio.
        if (error && error.killed) {
          const limitSeconds = Math.round((config.timeoutMs || 10 * 60 * 1000) / 1000);
          const timeoutNotice = `⏱ O teste não terminou dentro do tempo limite (${limitSeconds}s) e foi interrompido automaticamente. Isso costuma significar que o app travou numa tela, ficou esperando algo que nunca apareceu, ou o dispositivo desconectou no meio da execução.`;
          output = output.trim() ? `${timeoutNotice}\n\n${output}` : timeoutNotice;
        }

        let screenshotBase64 = null;
        try {
          const shot = findLatestScreenshot(debugDir);
          if (shot) screenshotBase64 = fs.readFileSync(shot).toString('base64');
        } catch {
          // sem print, sem problema — output de texto continua disponível
        }

        // Limpa a pasta temporária (não precisamos guardar, já lemos o que precisava)
        fs.rm(debugDir, { recursive: true, force: true }, () => {});

        resolve({ status, duration, output: cleanMaestroOutput(output), screenshotBase64 });
      }
    );
    onChildStarted?.(child);
  });
}

const server = http.createServer(async (req, res) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, baseFolder: config.baseFolder }));
    return;
  }

  if (req.method === 'POST' && req.url === '/mirror/open') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      let explicitPos = null;
      try {
        const parsed = body ? JSON.parse(body) : {};
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          explicitPos = { x: Math.round(parsed.x), y: Math.round(parsed.y) };
        }
      } catch {
        // corpo inválido/vazio — segue sem posição explícita
      }
      const result = await openMirror(explicitPos);
      res.writeHead(result.ok ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/mirror/close') {
    closeMirror();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'GET' && req.url === '/mirror/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, open: isMirrorRunning() }));
    return;
  }

  if (req.method === 'GET' && req.url === '/list-scripts') {
    try {
      const scripts = listAvailableScripts();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, scripts }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/jobs/')) {
    const jobId = req.url.slice('/jobs/'.length);
    const job = jobs.get(jobId);
    if (!job) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Job não encontrado — o agente pode ter sido reiniciado.' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (job.status === 'running') {
      res.end(JSON.stringify({ ok: true, status: 'running' }));
    } else {
      res.end(JSON.stringify({ ok: true, ...job.result }));
    }
    return;
  }

  if (req.method === 'POST' && req.url.startsWith('/jobs/') && req.url.endsWith('/cancel')) {
    const jobId = req.url.slice('/jobs/'.length, -'/cancel'.length);
    const job = jobs.get(jobId);
    if (!job) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Job não encontrado — o agente pode ter sido reiniciado.' }));
      return;
    }
    if (job.status === 'running') {
      console.log(`⛔ Cancelando: ${job.scriptPath} (job ${jobId})`);
      killProcessTree(job.process);
      job.status = 'cancelled';
      job.result = {
        status: 'cancelled',
        duration: Math.round((Date.now() - job.startedAt) / 1000),
        output: 'Execução cancelada pelo usuário.',
        screenshotBase64: null,
      };
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'POST' && req.url === '/run') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { scriptPath } = JSON.parse(body);
        if (!scriptPath) throw new Error('Nenhum "scriptPath" informado.');

        const fullPath = resolveSafeScriptPath(scriptPath);
        const jobId = createJob(scriptPath);
        console.log(`▶ Rodando: ${scriptPath} (job ${jobId})`);

        // Não espera terminar pra responder — o navegador recebe o jobId na
        // hora e consulta o andamento depois via GET /jobs/:id.
        runMaestro(fullPath, (child) => {
          const job = jobs.get(jobId);
          if (job) job.process = child;
        }).then((result) => {
          console.log(`${result.status === 'passed' ? '✅' : '❌'} ${scriptPath} — ${result.status} (${result.duration}s)`);
          finishJob(jobId, result);
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, jobId }));
      } catch (err) {
        console.error(`❌ Erro: ${err.message}`);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'Rota não encontrada.' }));
});

// Escuta só em 127.0.0.1 (não fica visível pra rede, só pro próprio computador)
server.listen(PORT, '127.0.0.1', () => {
  console.log('\n🟢 Agente do Maestro rodando!');
  console.log(`   Escutando em: http://127.0.0.1:${PORT}`);
  console.log(`   Pasta dos testes: ${config.baseFolder}`);
  console.log(`   Origem(ns) liberada(s): ${ALLOWED_ORIGINS.join(', ')}`);
  console.log('\n   Deixe esta janela aberta enquanto usar o botão "Executar automatizado" no Veiser Test.\n');
});

// Fecha a janela do scrcpy junto, se estiver aberta, quando o agente é encerrado
process.on('SIGINT', () => {
  closeMirror();
  process.exit(0);
});
