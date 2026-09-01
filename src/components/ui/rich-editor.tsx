import * as React from "react";
import { Bold, Italic, List, ListOrdered, Quote } from "lucide-react";
import { cn, richTextClasses } from "@/lib/utils";

export interface RichEditorProps {
  label?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  readOnly?: boolean;
}

function RichEditor({
  label,
  value,
  onChange,
  placeholder = "Digite aqui...",
  minHeight = "90px",
  readOnly = false,
}: RichEditorProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const isEmpty = !value || value === "<p><br></p>" || value.trim() === "";

  // Só define o HTML no mount — para trocar de registro (outro caso),
  // o componente pai deve passar key={caseId} para remontar do zero,
  // já que sincronizar a cada render faria o cursor pular pro início.
  React.useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = value || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(command: string, arg?: string) {
    document.execCommand(command, false, arg);
    ref.current?.focus();
    onChange(ref.current?.innerHTML ?? "");
  }

  if (readOnly) {
    return (
      <div className="flex flex-col gap-1.5">
        {label && <span className="text-sm font-medium text-foreground">{label}</span>}
        <div
          className={cn("prose-sm text-sm text-foreground", richTextClasses)}
          dangerouslySetInnerHTML={{ __html: isEmpty ? '<p class="text-muted-foreground">—</p>' : value }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <div className="rounded-lg border border-input bg-card overflow-hidden">
        <div className="flex items-center gap-0.5 border-b border-border px-1.5 py-1">
          <ToolbarButton onClick={() => exec("bold")} title="Negrito (Ctrl+B)">
            <Bold size={14} />
          </ToolbarButton>
          <ToolbarButton onClick={() => exec("italic")} title="Itálico (Ctrl+I)">
            <Italic size={14} />
          </ToolbarButton>
          <span className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton onClick={() => exec("insertUnorderedList")} title="Lista com marcadores">
            <List size={14} />
          </ToolbarButton>
          <ToolbarButton onClick={() => exec("insertOrderedList")} title="Lista numerada">
            <ListOrdered size={14} />
          </ToolbarButton>
          <span className="mx-1 h-4 w-px bg-border" />
          <ToolbarButton onClick={() => exec("formatBlock", "blockquote")} title="Citação">
            <Quote size={14} />
          </ToolbarButton>
        </div>
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={() => onChange(ref.current?.innerHTML ?? "")}
          onBlur={() => onChange(ref.current?.innerHTML ?? "")}
          data-placeholder={placeholder}
          className={cn(
            "px-3 py-2 text-sm text-foreground focus:outline-none",
            richTextClasses,
            "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
          )}
          style={{ minHeight }}
        />
      </div>
    </div>
  );
}

function ToolbarButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}

export { RichEditor };
