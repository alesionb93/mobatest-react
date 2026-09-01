import * as React from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";

export type ProjectRole = "owner" | "admin" | "member";

export interface ProjectMembership {
  id: string;
  name: string;
  code: string;
  role: ProjectRole;
}

interface ProjectContextValue {
  projects: ProjectMembership[];
  activeProject: ProjectMembership | null;
  setActiveProjectId: (id: string) => void;
  loading: boolean;
  reload: () => Promise<void>;
  createProject: (input: { name: string; code: string; description: string }) => Promise<string | null>;
}

const ProjectContext = React.createContext<ProjectContextValue | undefined>(undefined);

const STORAGE_KEY = "mobatest:active-project-id";

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = React.useState<ProjectMembership[]>([]);
  const [activeProjectId, setActiveProjectIdState] = React.useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [loading, setLoading] = React.useState(true);

  const loadProjects = React.useCallback(async () => {
    if (!user) {
      setProjects([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Membros só ficam listados aqui enquanto is_active = true (perderam acesso
    // se desativados, mas o histórico deles no projeto continua preservado).
    const { data, error } = await supabase
      .from("project_members")
      .select("role, is_active, projects(id, name, code)")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (error) {
      console.error("Erro ao carregar projetos do usuário:", error.message);
      setProjects([]);
      setLoading(false);
      return;
    }

    type Row = {
      role: ProjectRole;
      is_active: boolean;
      projects: { id: string; name: string; code: string } | { id: string; name: string; code: string }[] | null;
    };

    const list: ProjectMembership[] = (data as Row[])
      .map((row) => {
        const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
        if (!project) return null;
        return { id: project.id, name: project.name, code: project.code, role: row.role };
      })
      .filter((p): p is ProjectMembership => p !== null);

    setProjects(list);
    setLoading(false);
  }, [user]);

  React.useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Se o projeto ativo salvo não existir mais na lista (ou nenhum estiver
  // selecionado ainda), cai automaticamente no primeiro projeto disponível.
  React.useEffect(() => {
    if (loading) return;
    if (projects.length === 0) return;
    const stillValid = projects.some((p) => p.id === activeProjectId);
    if (!stillValid) {
      setActiveProjectIdState(projects[0].id);
    }
  }, [projects, loading, activeProjectId]);

  const setActiveProjectId = (id: string) => {
    setActiveProjectIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  async function createProject(input: { name: string; code: string; description: string }) {
    if (!user) return null;
    const { data, error } = await supabase
      .from("projects")
      .insert({ name: input.name, code: input.code, description: input.description || null, owner_id: user.id })
      .select()
      .single();
    if (error) {
      console.error("Erro ao criar projeto:", error.message);
      return null;
    }
    await loadProjects();
    setActiveProjectId(data.id);
    return data.id as string;
  }

  return (
    <ProjectContext.Provider
      value={{ projects, activeProject, setActiveProjectId, loading, reload: loadProjects, createProject }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = React.useContext(ProjectContext);
  if (!ctx) throw new Error("useProject precisa estar dentro de <ProjectProvider>");
  return ctx;
}
