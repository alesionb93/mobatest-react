import { EmptyState } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";

interface ModulePlaceholderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

function ModulePlaceholder({ title, description, icon }: ModulePlaceholderProps) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      <div className="rounded-xl border border-border bg-card">
        <EmptyState icon={icon} message="Este módulo ainda vai ser construído nos próximos passos." />
      </div>
    </div>
  );
}

export { ModulePlaceholder };
