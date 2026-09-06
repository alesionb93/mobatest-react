import * as React from "react";
import { CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseMaestroOutput } from "@/lib/maestro-log";

interface MaestroLogViewProps {
  output: string;
}

function MaestroLogView({ output }: MaestroLogViewProps) {
  const parsed = React.useMemo(() => {
    try {
      return parseMaestroOutput(output ?? "");
    } catch {
      return { device: undefined, flow: undefined, steps: [], cleanedRaw: output ?? "" };
    }
  }, [output]);
  const [showRaw, setShowRaw] = React.useState(false);

  if (parsed.steps.length === 0) {
    if (parsed.globalFailure) {
      return (
        <div className="rounded-md bg-red-50 border border-red-200 px-2.5 py-1.5 text-xs text-red-800">
          <p className="font-semibold mb-1">{parsed.globalFailure.title}</p>
          <p className="whitespace-pre-wrap break-words">{parsed.globalFailure.body}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-red-700 hover:text-red-900">Ver mensagem técnica original</summary>
            <p className="mt-1.5 whitespace-pre-wrap break-words font-mono-table opacity-80">{parsed.cleanedRaw}</p>
          </details>
        </div>
      );
    }
    return (
      <pre className="max-h-56 overflow-auto rounded-md bg-muted p-2.5 text-xs font-mono whitespace-pre-wrap break-words">
        {parsed.cleanedRaw || "(sem saída de log)"}
      </pre>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {(parsed.device || parsed.flow) && (
        <p className="text-xs text-muted-foreground">
          {parsed.flow && (
            <>
              Fluxo: <span className="font-medium text-foreground">{parsed.flow}</span>
            </>
          )}
          {parsed.device && parsed.flow && " · "}
          {parsed.device && <>Dispositivo: {parsed.device}</>}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {parsed.steps.map((step, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-start gap-2 text-sm">
              {step.status === "passed" ? (
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle size={15} className="text-red-600 shrink-0 mt-0.5" />
              )}
              <span className={cn(step.status === "failed" && "font-medium text-foreground")}>{step.label}</span>
            </div>
            {step.detail && (
              <div className="ml-[23px] rounded-md bg-red-50 border border-red-200 px-2.5 py-1.5 text-xs text-red-800">
                {step.friendlyReason ? (
                  <>
                    <p className="font-semibold mb-1">{step.friendlyReason.title}</p>
                    <p className="whitespace-pre-wrap break-words">{step.friendlyReason.body}</p>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-red-700 hover:text-red-900">
                        Ver mensagem técnica original
                      </summary>
                      <p className="mt-1.5 whitespace-pre-wrap break-words font-mono-table opacity-80">{step.detail}</p>
                    </details>
                  </>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{step.detail}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setShowRaw((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground self-start"
      >
        <ChevronDown size={12} className={cn("transition-transform", showRaw && "rotate-180")} />
        {showRaw ? "Ocultar" : "Ver"} log técnico completo
      </button>
      {showRaw && (
        <pre className="max-h-56 overflow-auto rounded-md bg-muted p-2.5 text-xs font-mono whitespace-pre-wrap break-words">
          {parsed.cleanedRaw}
        </pre>
      )}
    </div>
  );
}

export { MaestroLogView };
