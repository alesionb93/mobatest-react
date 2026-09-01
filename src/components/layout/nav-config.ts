import {
  LayoutDashboard,
  ListChecks,
  ClipboardList,
  PlayCircle,
  KanbanSquare,
  Bug,
  FileBarChart,
  Users,
  Settings2,
  FolderKanban,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Visão geral",
    items: [{ label: "Dashboard", to: "/", icon: LayoutDashboard }],
  },
  {
    label: "Testes",
    items: [
      { label: "Casos de teste", to: "/test-cases", icon: ListChecks },
      { label: "Planos de teste", to: "/test-plans", icon: ClipboardList },
      { label: "Execuções", to: "/test-runs", icon: PlayCircle },
    ],
  },
  {
    label: "Qualidade",
    items: [
      { label: "Defeitos", to: "/defects", icon: Bug },
      { label: "Jira", to: "/jira", icon: KanbanSquare },
      { label: "Relatórios", to: "/reports", icon: FileBarChart },
    ],
  },
  {
    label: "Espaço de trabalho",
    items: [
      { label: "Equipe", to: "/team", icon: Users },
      { label: "Cadastros", to: "/registries", icon: Settings2 },
      { label: "Projetos", to: "/projects", icon: FolderKanban },
    ],
  },
];
