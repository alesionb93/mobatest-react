import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full border",
  {
    variants: {
      variant: {
        success: "bg-emerald-50 text-emerald-700 border-emerald-200",
        danger: "bg-red-50 text-red-700 border-red-200",
        info: "bg-blue-50 text-blue-700 border-blue-200",
        warning: "bg-amber-50 text-amber-700 border-amber-200",
        neutral: "bg-slate-100 text-slate-600 border-slate-200",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

const dotColor: Record<string, string> = {
  success: "bg-emerald-500",
  danger: "bg-red-500",
  info: "bg-blue-500",
  warning: "bg-amber-500",
  neutral: "bg-slate-400",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  const key = variant ?? "neutral";
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColor[key])} />}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
