import * as React from "react";
import { Download } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { parseImportCSV, downloadImportTemplateCSV, type ParsedImportResult } from "@/lib/test-case-csv";
import type { TestSuite } from "@/types/test-cases";

interface ImportCsvModalProps {
  open: boolean;
  onClose: () => void;
  suites: TestSuite[];
  onConfirm: (result: ParsedImportResult, suiteId: string | null) => Promise<void>;
}

function ImportCsvModal({ open, onClose, suites, onConfirm }: ImportCsvModalProps) {
  const [result, setResult] = React.useState<ParsedImportResult | null>(null);
  const [fileName, setFileName] = React.useState("");
  const [suiteId, setSuiteId] = React.useState("");
  const [importing, setImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function reset() {
    setResult(null);
    setFileName("");
    setSuiteId("");
  }

  async function handleFile(file: File) {
    const text = await file.text();
    setFileName(file.name);
    setResult(parseImportCSV(text));
  }

  async function handleConfirm() {
    if (!result || result.cases.length === 0) return;
    setImporting(true);
    await onConfirm(result, suiteId || null);
    setImporting(false);
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Importar casos de teste via CSV"
      size="md"
      footer={
        result && result.cases.length > 0 ? (
          <>
            <Button variant="secondary" onClick={() => reset()}>
              Escolher outro arquivo
            </Button>
            <Button onClick={handleConfirm} disabled={importing}>
              {importing ? "Importando..." : `Importar ${result.cases.length} caso(s)`}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <button
          onClick={downloadImportTemplateCSV}
          className="flex items-center gap-2 text-sm text-brand hover:underline self-start"
        >
          <Download size={14} />
          Baixar modelo de planilha
        </button>

        {!result && (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            className="rounded-lg border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground cursor-pointer hover:border-ring"
          >
            Clique ou arraste um arquivo .csv aqui
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-foreground">
              <strong>{fileName}</strong> — {result.cases.length} caso(s) válido(s)
              {result.skipped > 0 && `, ${result.skipped} linha(s) ignorada(s) (sem título)`}.
            </p>
            {result.cases.length > 0 && (
              <Select
                label="Importar para a suíte"
                value={suiteId}
                onChange={setSuiteId}
                options={[{ value: "", label: "Sem suíte" }, ...suites.map((s) => ({ value: s.id, label: s.title }))]}
              />
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

export { ImportCsvModal };
