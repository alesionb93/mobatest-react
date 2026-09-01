import { NavLink } from "react-router-dom";
import { ChevronsLeft, ChevronsRight, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { navGroups } from "@/components/layout/nav-config";
import { useAuth } from "@/contexts/auth-context";
import { useProject } from "@/contexts/project-context";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

function initialsFromEmail(email: string | undefined) {
  if (!email) return "?";
  return email.slice(0, 2).toUpperCase();
}

function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, signOut } = useAuth();
  const { activeProject } = useProject();
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";

  return (
    <aside
      className={cn(
        "flex flex-col shrink-0 h-screen sticky top-0 bg-sidebar border-r border-sidebar-border transition-all duration-200",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      <div className="h-14 flex items-center gap-2 px-4 border-b border-sidebar-border">
        <img src="/veiser-icon.png" alt="Veiser" className="h-7 w-7 shrink-0 rounded-md object-cover" />
        {!collapsed && (
          <span className="text-sm font-semibold text-sidebar-foreground truncate">
            {activeProject ? activeProject.name : "Veiser Test"}
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 flex flex-col gap-5">
        {navGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1 px-3">
            {!collapsed && (
              <span className="px-2 pb-1 text-xs font-medium text-muted-foreground">
                {group.label}
              </span>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-sidebar-foreground transition-colors",
                    "hover:bg-sidebar-accent",
                    isActive && "bg-sidebar-accent-foreground/10",
                    collapsed && "justify-center"
                  )
                }
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3 flex flex-col gap-2">
        <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
            {initialsFromEmail(user?.email)}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => signOut()}
              className="text-muted-foreground hover:text-destructive rounded-md p-1.5"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
        <button
          onClick={onToggle}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent",
            collapsed && "justify-center"
          )}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          {!collapsed && "Recolher"}
        </button>
      </div>
    </aside>
  );
}

export { Sidebar };
