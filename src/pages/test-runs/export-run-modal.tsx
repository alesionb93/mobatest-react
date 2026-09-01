import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ExportRunModalProps {
  open: boolean;
  onClose: () => void;
  initialNotes: string;
  onExport: (format: "csv" | "pdf", notes: string) => Promise<void>;
}

function ExportRunModal({ open, onClose, initialNotes, onExport }: ExportRunModalProps) {
  const [format, setFormat] = React.useState("csv");
  const [notes, setNotes] = React.useState(initialNotes);
  const [exporting, setExporting] = React.useState(false);

  React.useEffect(() => {
    if (open) setNotes(initialNotes);
  }, [open, initialNotes]);

  async function handleExport() {
    setExporting(true);
    await onExport(format as "csv" | "pdf", notes.trim());
    setExporting(false);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Exportar execução"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? "Exportando..." : "Exportar"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          label="Formato"
          value={format}
          onChange={setFormat}
          options={[
            { value: "csv", label: "CSV" },
            { value: "pdf", label: "PDF (via impressão do navegador)" },
          ]}
        />
        <div className="flex flex-col gap-1">
          <Textarea
            label="Observações"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Alguma ressalva ou observação para este relatório?"
          />
          <p className="text-xs text-muted-foreground">Fica salva junto com a execução para a próxima exportação.</p>
        </div>
      </div>
    </Modal>
  );
}

export { ExportRunModal };
