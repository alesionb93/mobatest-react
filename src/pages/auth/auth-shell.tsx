import * as React from "react";
import veiserMark from "@/assets/veiser-mark.svg";

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-card p-8 shadow-elevation-card">
          <div className="mb-6 text-center">
            <div className="mb-3 flex items-center justify-center gap-1">
              <img src={veiserMark} alt="Veiser" className="h-10 w-auto" />
              <span
                className="text-[44px] leading-none font-semibold tracking-tight text-foreground"
                style={{ fontFamily: "'Urbanist', 'Noto Sans', sans-serif" }}
              >
                Test
              </span>
            </div>
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
          {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export { AuthShell };
