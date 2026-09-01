import * as React from "react";
import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface MetricInfo {
  name: string;
  objective: string;
  rule: string;
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  delta?: string;
  colorClassName?: string;
  info: MetricInfo;
}

function InfoTooltip({ info }: { info: MetricInfo }) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <span className="relative inline-block" ref={rootRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="text-muted-foreground hover:text-foreground align-middle ml-1"
        title="Sobre este indicador"
      >
        <Info size={13} />
      </button>
      {open && (
        <div className="absolute z-40 top-5 left-0 w-64 rounded-lg border border-border bg-popover shadow-lg p-3 text-left">
          <p className="text-xs font-semibold text-foreground mb-1.5">{info.name}</p>
          <p className="text-xs text-muted-foreground mb-1">
            <strong className="text-foreground">Objetivo:</strong> {info.objective}
          </p>
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Cálculo:</strong> {info.rule}
          </p>
        </div>
      )}
    </span>
  );
}

function StatCard({ label, value, delta, colorClassName, info }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground flex items-center">
          {label}
          <InfoTooltip info={info} />
        </p>
        <p className={cn("text-[30px] leading-9 font-semibold text-foreground mt-1", colorClassName)}>{value}</p>
        {delta && <p className="text-xs text-muted-foreground mt-1">{delta}</p>}
      </CardContent>
    </Card>
  );
}

export { StatCard };
