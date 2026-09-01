import * as React from "react";
import { RichEditor } from "@/components/ui/rich-editor";
import { richTextClasses } from "@/lib/utils";

export interface CollapsibleFieldProps {
  label: string;
  value: string;
  onChange: (html: string) => void;
  emptyLabel?: string;
  placeholder?: string;
  minHeight?: string;
}

function CollapsibleField({
  label,
  value,
  onChange,
  emptyLabel = "Não preenchido — clique para preencher",
  placeholder,
  minHeight = "80px",
}: CollapsibleFieldProps) {
  const [expanded, setExpanded] = React.useState(false);
  const isEmpty = !value || value === "<p><br></p>" || value.trim() === "";

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      {expanded ? (
        <RichEditor value={value} onChange={onChange} placeholder={placeholder} minHeight={minHeight} />
      ) : (
        <div
          onClick={() => setExpanded(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setExpanded(true)}
          className="rounded-lg border border-transparent px-1 py-1 -mx-1 text-sm cursor-text hover:border-border hover:bg-muted/40"
        >
          {isEmpty ? (
            <span className="text-muted-foreground italic">{emptyLabel}</span>
          ) : (
            <div
              className={richTextClasses + " text-foreground"}
              dangerouslySetInnerHTML={{ __html: value }}
            />
          )}
        </div>
      )}
    </div>
  );
}

export { CollapsibleField };
