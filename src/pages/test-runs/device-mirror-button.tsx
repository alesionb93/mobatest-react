import * as React from "react";
import { Smartphone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { openDeviceMirror, closeDeviceMirror, getDeviceMirrorStatus } from "@/lib/maestro-agent";

function computeMirrorPosition(): { x: number; y: number } | null {
  // Acha o painel do modal aberto na tela e calcula onde ele está de
  // verdade no monitor (não só dentro da página) — é isso que garante o
  // scrcpy abrir exatamente do lado dele, mesmo com vários monitores.
  const dialogEl = document.querySelector('[role="dialog"]');
  if (!dialogEl) return null;
  const rect = dialogEl.getBoundingClientRect();
  const chromeOffsetY = Math.max(window.outerHeight - window.innerHeight, 0);
  const cssX = window.screenX + rect.right + 12;
  const cssY = window.screenY + chromeOffsetY + rect.top;
  // O navegador mede tudo em "pixels CSS" — o Windows posiciona janelas em
  // pixels físicos de verdade. Numa tela com escala 125%/150%/etc, isso é
  // diferente, e sem essa conversão a janela abre mais perto do que devia
  // (foi o que aconteceu: abriu por cima do modal em vez de do lado).
  const dpr = window.devicePixelRatio || 1;
  return {
    x: Math.round(cssX * dpr),
    y: Math.round(cssY * dpr),
  };
}

function DeviceMirrorButton() {
  const [open, setOpen] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    getDeviceMirrorStatus().then((data) => {
      if (data.ok) setOpen(data.open);
    });
  }, []);

  async function handleClick() {
    setLoading(true);
    if (open) {
      await closeDeviceMirror();
      setOpen(false);
    } else {
      const result = await openDeviceMirror(computeMirrorPosition() ?? undefined);
      if (!result.ok) {
        toast.error(result.error);
      } else {
        setOpen(true);
        if (result.alreadyOpen) toast.info("O espelho já estava aberto.");
      }
    }
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
      title="Abre a janela do scrcpy já posicionada do lado do navegador"
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : <Smartphone size={13} />}
      {open ? "Fechar espelho" : "Abrir espelho do dispositivo"}
    </button>
  );
}

export { DeviceMirrorButton };
