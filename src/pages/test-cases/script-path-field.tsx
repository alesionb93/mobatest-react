import * as React from "react";
import { Pencil, ListTree } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";

const AGENT_LIST_URL = "http://127.0.0.1:4545/list-scripts";

function fileNameOf(relPath: string) {
  const parts = relPath.split("/");
  return parts[parts.length - 1].replace(/\.ya?ml$/i, "");
}

interface ScriptPathFieldProps {
  value: string;
  onChange: (value: string) => void;
}

function ScriptPathField({ value, onChange }: ScriptPathFieldProps) {
  const [scripts, setScripts] = React.useState<string[] | null>(null);
  const [agentError, setAgentError] = React.useState(false);
  const [manualMode, setManualMode] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetch(AGENT_LIST_URL)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setScripts(data.scripts as string[]);
        else setAgentError(true);
      })
      .catch(() => {
        if (!cancelled) setAgentError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const useManual = manualMode || agentError || scripts === null;

  if (useManual) {
    return (
      <div className="flex flex-col gap-1.5">
        <Input
          label="Caminho do script Maestro (.yaml)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ex: flows/01-login/C1_login-com-credenciais-validas.yaml"
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Caminho relativo à pasta configurada no seu agente local — permite rodar o teste automatizado direto de
            uma execução.
          </p>
          {scripts !== null && !agentError && (
            <button
              type="button"
              onClick={() => setManualMode(false)}
              className="shrink-0 text-xs text-brand hover:underline inline-flex items-center gap-1 ml-2"
            >
              <ListTree size={12} /> Escolher da lista
            </button>
          )}
        </div>
        {agentError && (
          <p className="text-xs text-muted-foreground">
            Agente local não encontrado — inicie o <code>maestro-agent</code> pra escolher o teste de uma lista em
            vez de digitar o caminho.
          </p>
        )}
      </div>
    );
  }

  const options = scripts.map((s) => ({ value: s, label: fileNameOf(s), sublabel: s }));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Script Maestro (.yaml)</span>
        <button
          type="button"
          onClick={() => setManualMode(true)}
          className="text-xs text-brand hover:underline inline-flex items-center gap-1"
        >
          <Pencil size={12} /> Digitar manualmente
        </button>
      </div>
      <Combobox
        options={options}
        value={value}
        onChange={onChange}
        placeholder="Buscar teste pelo nome..."
        emptyMessage="Nenhum .yaml encontrado nessa pasta."
      />
      <p className="text-xs text-muted-foreground">
        Lista lida direto da pasta configurada no seu agente local ({scripts.length} teste(s) encontrado(s)).
      </p>
    </div>
  );
}

export { ScriptPathField };
