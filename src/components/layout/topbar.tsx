import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Search, ListChecks, Bug, PlayCircle, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useProject } from "@/contexts/project-context";

interface SearchResult {
  id: string;
  title: string;
  type: "test_case" | "defect" | "test_run";
}

const typeMeta: Record<SearchResult["type"], { label: string; icon: typeof ListChecks; route: (id: string) => string }> = {
  test_case: { label: "Casos de teste", icon: ListChecks, route: (id) => `/test-cases/${id}` },
  defect: { label: "Defeitos", icon: Bug, route: (id) => `/defects/${id}` },
  test_run: { label: "Execuções", icon: PlayCircle, route: (id) => `/test-runs/${id}` },
};

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function GlobalSearch() {
  const { activeProject } = useProject();
  const navigate = useNavigate();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  React.useEffect(() => {
    if (!debouncedQuery.trim() || !activeProject) {
      setResults([]);
      return;
    }
    let cancelled = false;
    async function search() {
      setLoading(true);
      const term = `%${debouncedQuery}%`;
      const [cases, defects, runs] = await Promise.all([
        supabase
          .from("test_cases")
          .select("id, title")
          .eq("project_id", activeProject!.id)
          .ilike("title", term)
          .limit(5),
        supabase
          .from("defects")
          .select("id, title")
          .eq("project_id", activeProject!.id)
          .ilike("title", term)
          .limit(5),
        supabase
          .from("test_runs")
          .select("id, title")
          .eq("project_id", activeProject!.id)
          .ilike("title", term)
          .limit(5),
      ]);
      if (cancelled) return;
      const mapped: SearchResult[] = [
        ...(cases.data ?? []).map((r) => ({ id: r.id, title: r.title, type: "test_case" as const })),
        ...(defects.data ?? []).map((r) => ({ id: r.id, title: r.title, type: "defect" as const })),
        ...(runs.data ?? []).map((r) => ({ id: r.id, title: r.title, type: "test_run" as const })),
      ];
      setResults(mapped);
      setLoading(false);
    }
    search();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, activeProject]);

  const grouped = React.useMemo(() => {
    const groups: Record<SearchResult["type"], SearchResult[]> = {
      test_case: [],
      defect: [],
      test_run: [],
    };
    for (const r of results) groups[r.type].push(r);
    return groups;
  }, [results]);

  function goTo(result: SearchResult) {
    navigate(typeMeta[result.type].route(result.id));
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="relative w-full max-w-md" ref={rootRef}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar casos, defeitos, execuções..."
        className="w-full rounded-lg border border-input bg-card py-1.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {open && query.trim() && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-80 overflow-auto">
          {loading && <p className="px-3 py-3 text-sm text-muted-foreground">Buscando...</p>}
          {!loading && results.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted-foreground">Nenhum resultado para "{query}".</p>
          )}
          {!loading &&
            (Object.keys(grouped) as SearchResult["type"][]).map((type) =>
              grouped[type].length > 0 ? (
                <div key={type} className="py-1">
                  <p className="px-3 py-1 text-xs font-medium text-muted-foreground">
                    {typeMeta[type].label}
                  </p>
                  {grouped[type].map((r) => {
                    const Icon = typeMeta[type].icon;
                    return (
                      <button
                        key={r.id}
                        onClick={() => goTo(r)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <Icon size={14} className="shrink-0 text-muted-foreground" />
                        <span className="truncate">{r.title}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null
            )}
        </div>
      )}
    </div>
  );
}

function ProjectSwitcher() {
  const { projects, activeProject, setActiveProjectId } = useProject();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (projects.length === 0) return null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-1.5 text-sm hover:bg-secondary"
      >
        <span className="truncate max-w-[140px]">{activeProject?.name ?? "Selecionar projeto"}</span>
        <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-56 rounded-lg border border-border bg-popover shadow-lg py-1">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setActiveProjectId(p.id);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <span className="truncate">{p.name}</span>
              {p.id === activeProject?.id && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Topbar() {
  return (
    <header className="h-14 border-b border-border bg-background/80 backdrop-blur-md flex items-center gap-4 px-4 sticky top-0 z-30">
      <GlobalSearch />
      <div className="flex-1" />
      <ProjectSwitcher />
    </header>
  );
}

export { Topbar };
