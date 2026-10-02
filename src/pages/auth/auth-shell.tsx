import * as React from "react";
import veiserLogo from "@/assets/marca/veiser-test-horizontal.svg";
import veiserLogoNegativo from "@/assets/marca/veiser-test-horizontal-negativo.svg";
import { useTheme } from "@/contexts/theme-context";

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  const { theme } = useTheme();

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-border bg-card p-8 shadow-elevation-card">
          <div className="mb-6 text-center">
            <div className="mb-4 flex items-center justify-center">
              <img
                src={theme === "dark" ? veiserLogoNegativo : veiserLogo}
                alt="Veiser Test"
                className="h-9 w-auto"
              />
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
