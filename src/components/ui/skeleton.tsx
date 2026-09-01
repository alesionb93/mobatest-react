import { cn } from "@/lib/utils";
import { Inbox, type LucideIcon } from "lucide-react";

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

interface EmptyStateProps {
  icon?: LucideIcon;
  message: string;
  action?: React.ReactNode;
}

function EmptyState({ icon: Icon = Inbox, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon size={20} className="text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
      {action}
    </div>
  );
}

export { Skeleton, EmptyState };
