/**
 * Compressão de evidência (foto/vídeo) feita no próprio navegador, ANTES do upload.
 *
 * Por quê: o Storage do Supabase tem cota pequena e cada print/vídeo de celular
 * costuma ter de 1 a 30 MB. Comprimindo aqui, o que sobe é uma fração disso.
 * Não usa nenhuma biblioteca externa — só APIs nativas (canvas e MediaRecorder).
 *
 * Todos os números que mexem em qualidade × tamanho estão em EVIDENCE_LIMITS,
 * num lugar só, pra ajustar sem mexer na lógica.
 */

export const EVIDENCE_LIMITS = {
  /** Maior arquivo que a gente aceita nem tentar comprimir. */
  maxInputBytes: 300 * 1024 * 1024,
  /** Maior arquivo que pode SUBIR, depois de comprimido. */
  maxOutputBytes: 25 * 1024 * 1024,
  /** Se não der pra comprimir, só sobe o original se ele for pequeno assim. */
  uncompressedFallbackBytes: 10 * 1024 * 1024,

  /** Foto: lado maior em pixels (screenshot de celular 1080x2400 vira ~720x1600, ainda legível). */
  imageMaxSide: 1600,
  /** Foto: qualidade do WebP (0 a 1). */
  imageQuality: 0.62,

  /** Vídeo: duração máxima (a compressão roda em tempo real: 1 min de vídeo = ~1 min de espera). */
  maxVideoSeconds: 180,
  /** Vídeo: lado maior em pixels. */
  videoMaxSide: 960,
  /** Vídeo: quadros por segundo (evidência de tela não precisa de mais que isso). */
  videoFps: 15,
  /** Vídeo: bitrate alvo (~3,4 MB por minuto). */
  videoBitsPerSecond: 450_000,
} as const;

/** Quanto do vídeo pode faltar na versão comprimida: o maior entre 1s e 10% (início/fim da gravação perdem uns décimos). */
function allowedLossSeconds(durationSeconds: number): number {
  return Math.max(1, durationSeconds * 0.1);
}

export interface CompressedMedia {
  blob: Blob;
  fileName: string;
  fileType: string;
  originalSize: number;
  size: number;
  /** false quando o original foi mantido (já era menor, ou não deu pra comprimir). */
  compressed: boolean;
}

/** Recebe um número de 0 a 1. */
export type CompressProgress = (ratio: number) => void;

/** Erro com mensagem já pronta pra mostrar pro usuário. */
export class MediaCompressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaCompressionError";
  }
}

function baseName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function keepOriginal(file: File): CompressedMedia {
  return {
    blob: file,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    originalSize: file.size,
    size: file.size,
    compressed: false,
  };
}

/** Só usa a versão comprimida se ela realmente ficou menor. */
function pickSmaller(original: File, candidate: Blob, candidateName: string): CompressedMedia {
  if (candidate.size >= original.size) return keepOriginal(original);
  return {
    blob: candidate,
    fileName: candidateName,
    fileType: candidate.type,
    originalSize: original.size,
    size: candidate.size,
    compressed: true,
  };
}

function fitInside(width: number, height: number, maxSide: number): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Encoders de vídeo exigem largura/altura pares. */
function evenSize(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

/** Espera um evento, com prazo — pra um arquivo estranho não travar a tela pra sempre. */
function once(target: EventTarget, okEvent: string, timeoutMs: number, failEvent?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (done: () => void) => {
      window.clearTimeout(timer);
      target.removeEventListener(okEvent, onOk);
      if (failEvent) target.removeEventListener(failEvent, onFail);
      done();
    };
    const onOk = () => finish(resolve);
    const onFail = () => finish(() => reject(new MediaCompressionError("O navegador não conseguiu ler esse arquivo.")));
    const timer = window.setTimeout(
      () => finish(() => reject(new MediaCompressionError("O navegador demorou demais pra ler esse arquivo."))),
      timeoutMs
    );
    target.addEventListener(okEvent, onOk, { once: true });
    if (failEvent) target.addEventListener(failEvent, onFail, { once: true });
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// ---------------------------------------------------------------------------
// Foto
// ---------------------------------------------------------------------------

async function compressImage(file: File): Promise<CompressedMedia> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new MediaCompressionError("O navegador não conseguiu abrir essa imagem (formato não suportado).");
  }

  try {
    const { width, height } = fitInside(bitmap.width, bitmap.height, EVIDENCE_LIMITS.imageMaxSide);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new MediaCompressionError("O navegador não conseguiu preparar a imagem.");

    // Fundo branco: evita que transparência vire preto ao cair pra JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    // Se o navegador não souber gerar WebP, toBlob devolve PNG (maior) — por isso
    // confere o tipo que voltou e tenta JPEG em seguida.
    for (const type of ["image/webp", "image/jpeg"] as const) {
      const blob = await canvasToBlob(canvas, type, EVIDENCE_LIMITS.imageQuality);
      if (blob && blob.type === type) {
        const ext = type === "image/webp" ? "webp" : "jpg";
        return pickSmaller(file, blob, `${baseName(file.name)}.${ext}`);
      }
    }
    throw new MediaCompressionError("O navegador não conseguiu comprimir essa imagem.");
  } finally {
    bitmap.close();
  }
}

// ---------------------------------------------------------------------------
// Vídeo
// ---------------------------------------------------------------------------

function pickRecorderMime(): string | null {
  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  return candidates.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

/**
 * Vídeos .webm gravados pelo próprio navegador costumam declarar duração
 * "Infinity". O truque é pular pro "fim impossível" pra o navegador descobrir
 * a duração de verdade, e voltar pro começo.
 */
async function ensureFiniteDuration(video: HTMLVideoElement): Promise<void> {
  if (Number.isFinite(video.duration)) return;
  const probe = once(video, "timeupdate", 10_000);
  video.currentTime = 1e101;
  await probe;
  const back = once(video, "seeked", 10_000);
  video.currentTime = 0;
  await back;
  if (!Number.isFinite(video.duration)) {
    throw new MediaCompressionError("Não consegui descobrir a duração desse vídeo.");
  }
}

/** Abre o blob num <video> só pra descobrir a duração real dele. */
async function probeDuration(blob: Blob): Promise<number> {
  const url = URL.createObjectURL(blob);
  const probe = document.createElement("video");
  probe.muted = true;
  probe.preload = "metadata";
  probe.src = url;
  try {
    await once(probe, "loadedmetadata", 15_000, "error");
    await ensureFiniteDuration(probe);
    return probe.duration;
  } finally {
    probe.removeAttribute("src");
    probe.load();
    URL.revokeObjectURL(url);
  }
}

/**
 * Recomprime o vídeo tocando ele (sem som) num canvas reduzido e gravando o
 * canvas com bitrate baixo. Roda em tempo real — precisa da aba aberta.
 * O áudio é descartado de propósito: evidência de teste é comportamento de tela.
 */
async function compressVideo(file: File, onProgress?: CompressProgress): Promise<CompressedMedia> {
  if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") {
    throw new MediaCompressionError("Este navegador não sabe comprimir vídeo.");
  }
  const mimeType = pickRecorderMime();
  if (!mimeType) throw new MediaCompressionError("Este navegador não tem um formato de vídeo pra comprimir.");

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let timer: number | undefined;

  try {
    await once(video, "loadedmetadata", 20_000, "error");
    await ensureFiniteDuration(video);

    const duration = video.duration;
    if (duration > EVIDENCE_LIMITS.maxVideoSeconds) {
      throw new MediaCompressionError(
        `O vídeo tem ${Math.round(duration)}s e o máximo é ${EVIDENCE_LIMITS.maxVideoSeconds}s. Corte o vídeo e tente de novo.`
      );
    }
    if (!video.videoWidth || !video.videoHeight) {
      throw new MediaCompressionError("Esse arquivo não tem imagem de vídeo.");
    }

    const fitted = fitInside(video.videoWidth, video.videoHeight, EVIDENCE_LIMITS.videoMaxSide);
    const canvas = document.createElement("canvas");
    canvas.width = evenSize(fitted.width);
    canvas.height = evenSize(fitted.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new MediaCompressionError("O navegador não conseguiu preparar o vídeo.");

    stream = canvas.captureStream(EVIDENCE_LIMITS.videoFps);
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: EVIDENCE_LIMITS.videoBitsPerSecond });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const stopped = new Promise<void>((resolve) => {
      if (recorder) recorder.onstop = () => resolve();
    });

    const draw = () => ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    draw();
    recorder.start();
    await video.play();

    await new Promise<void>((resolve, reject) => {
      let lastTime = -1;
      let lastChange = Date.now();
      video.onended = () => resolve();
      video.onerror = () => reject(new MediaCompressionError("O navegador parou de ler o vídeo no meio."));
      timer = window.setInterval(() => {
        draw();
        onProgress?.(Math.min(1, video.currentTime / duration));
        if (video.currentTime !== lastTime) {
          lastTime = video.currentTime;
          lastChange = Date.now();
        } else if (Date.now() - lastChange > 15_000) {
          reject(new MediaCompressionError("A compressão travou (a aba ficou em segundo plano?). Tente de novo."));
        }
      }, 1000 / EVIDENCE_LIMITS.videoFps);
    });

    window.clearInterval(timer);
    timer = undefined;
    draw();
    if (recorder.state !== "inactive") recorder.stop();
    await stopped;
    onProgress?.(1);

    const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
    if (blob.size === 0) throw new MediaCompressionError("A compressão não gerou nenhum vídeo.");

    // Trava de integridade: a gravação acompanha o relógio, então num computador que não
    // dá conta de decodificar o vídeo em tempo real ela PERDE trechos sem dar erro. Se o
    // arquivo gerado for bem mais curto que o original, melhor recusar do que perder evidência.
    const producedSeconds = await probeDuration(blob);
    if (producedSeconds < duration - allowedLossSeconds(duration)) {
      throw new MediaCompressionError(
        "A compressão perdeu parte do vídeo (este computador não conseguiu acompanhar). Tente um vídeo mais curto ou em resolução menor."
      );
    }

    const ext = blob.type === "video/mp4" ? "mp4" : "webm";
    return pickSmaller(file, blob, `${baseName(file.name)}.${ext}`);
  } finally {
    if (timer !== undefined) window.clearInterval(timer);
    if (recorder && recorder.state !== "inactive") recorder.stop();
    stream?.getTracks().forEach((t) => t.stop());
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

// ---------------------------------------------------------------------------
// Entrada única
// ---------------------------------------------------------------------------

/**
 * Comprime uma foto ou vídeo pra virar evidência. Devolve sempre o menor entre
 * o original e o comprimido. Lança MediaCompressionError (mensagem pronta pra
 * tela) se o arquivo não puder ser aceito.
 */
export async function compressEvidence(file: File, onProgress?: CompressProgress): Promise<CompressedMedia> {
  if (file.size > EVIDENCE_LIMITS.maxInputBytes) {
    throw new MediaCompressionError(
      `"${file.name}" passa de ${Math.round(EVIDENCE_LIMITS.maxInputBytes / (1024 * 1024))} MB.`
    );
  }

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) {
    throw new MediaCompressionError(`"${file.name}" não é foto nem vídeo.`);
  }

  let result: CompressedMedia;
  try {
    if (isVideo) {
      result = await compressVideo(file, onProgress);
    } else if (file.type === "image/gif" || file.type === "image/svg+xml") {
      // GIF animado perderia a animação num canvas, e SVG já é minúsculo.
      result = keepOriginal(file);
    } else {
      result = await compressImage(file);
    }
  } catch (err) {
    const reason = err instanceof MediaCompressionError ? err.message : "Falha ao comprimir.";
    // Não deu pra comprimir: só aceita o original se ele já for pequeno.
    if (file.size <= EVIDENCE_LIMITS.uncompressedFallbackBytes) {
      result = keepOriginal(file);
    } else {
      throw new MediaCompressionError(`${reason} (${file.name})`);
    }
  }

  if (result.size > EVIDENCE_LIMITS.maxOutputBytes) {
    throw new MediaCompressionError(
      `"${file.name}" continua com mais de ${Math.round(EVIDENCE_LIMITS.maxOutputBytes / (1024 * 1024))} MB mesmo comprimido.`
    );
  }
  return result;
}
