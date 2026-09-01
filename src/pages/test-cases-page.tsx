import * as React from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useProject } from "@/contexts/project-context";
import { useTestCasesData } from "@/pages/test-cases/use-test-cases-data";
import { SuiteTree } from "@/pages/test-cases/suite-tree";
import { CaseTable } from "@/pages/test-cases/case-table";
import { CaseDrawer } from "@/pages/test-cases/case-drawer";
import { ImportCsvModal } from "@/pages/test-cases/import-csv-modal";
import { exportCasesToCSV } from "@/lib/test-case-csv";
import { supabase } from "@/lib/supabase";
import { Skeleton } from "@/components/ui/skeleton";
import type { TestCase, TestCaseInput } from "@/types/test-cases";

function TestCasesPage() {
  const { activeProject } = useProject();
  const { id: caseIdFromUrl } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const jiraPrefill = location.state as { prefillTitle?: string; jiraQueueItemId?: string } | null;

  const {
    loading,
    suites,
    cases,
    historyByCase,
    createSuite,
    renameSuite,
    moveSuite,
    deleteSuite,
    createCase,
    updateCase,
    duplicateCase,
    deleteCase,
    bulkUpdateCases,
    bulkCreateCases,
    bulkDeleteCases,
  } = useTestCasesData();

  const [selectedSuiteId, setSelectedSuiteId] = React.useState<string | "all">("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [drawerState, setDrawerState] = React.useState<
    { mode: "view"; testCase: TestCase } | { mode: "create" } | null
  >(null);
  const [importOpen, setImportOpen] = React.useState(false);

  // Abre o caso direto se veio de /test-cases/:id (link da busca global, por exemplo)
  React.useEffect(() => {
    if (!caseIdFromUrl || loading) return;
    const target = cases.find((c) => c.id === caseIdFromUrl);
    if (target) setDrawerState({ mode: "view", testCase: target });
  }, [caseIdFromUrl, cases, loading]);

  const [prefillTitle, setPrefillTitle] = React.useState<string | undefined>(undefined);
  const [jiraQueueItemId, setJiraQueueItemId] = React.useState<string | undefined>(undefined);

  // Veio da fila do Jira ("Criar caso de teste")? Abre o painel de criação
  // já com o título preenchido, e limpa o state pra não reabrir num "voltar".
  React.useEffect(() => {
    if (!jiraPrefill?.prefillTitle) return;
    setPrefillTitle(jiraPrefill.prefillTitle);
    setJiraQueueItemId(jiraPrefill.jiraQueueItemId);
    setDrawerState({ mode: "create" });
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function closeDrawer() {
    setDrawerState(null);
    if (caseIdFromUrl) navigate("/test-cases", { replace: true });
  }

  const casesCountBySuite = React.useMemo(() => {
    const map: Record<string, number> = {};
    cases.forEach((c) => {
      if (c.suite_id) map[c.suite_id] = (map[c.suite_id] ?? 0) + 1;
    });
    return map;
  }, [cases]);

  const filteredCases = React.useMemo(() => {
    return cases.filter((c) => {
      const matchesSuite = selectedSuiteId === "all" || c.suite_id === selectedSuiteId;
      const matchesSearch = !searchTerm || c.title.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSuite && matchesSearch;
    });
  }, [cases, selectedSuiteId, searchTerm]);

  const suiteTitleById = React.useMemo(() => {
    const map: Record<string, string> = {};
    suites.forEach((s) => (map[s.id] = s.title));
    return map;
  }, [suites]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Casos de teste</h1>
        <p className="text-sm text-muted-foreground">Organize suítes e mantenha os cenários de teste do projeto.</p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        <SuiteTree
          suites={suites}
          casesCountBySuite={casesCountBySuite}
          totalCasesCount={cases.length}
          selectedSuiteId={selectedSuiteId}
          onSelectSuite={setSelectedSuiteId}
          onCreateSuite={createSuite}
          onRenameSuite={renameSuite}
          onMoveSuite={moveSuite}
          onDeleteSuite={deleteSuite}
        />

        <CaseTable
          cases={filteredCases}
          suites={suites}
          projectCode={activeProject?.code ?? ""}
          historyByCase={historyByCase}
          onOpenCase={(testCase) => setDrawerState({ mode: "view", testCase })}
          onNewCase={() => setDrawerState({ mode: "create" })}
          onImportCSV={() => setImportOpen(true)}
          onExportCSV={(list) => exportCasesToCSV(list, suiteTitleById, activeProject?.code ?? "PROJ")}
          onDuplicate={duplicateCase}
          onBulkUpdate={(ids, patch) => bulkUpdateCases(ids, patch as Partial<TestCaseInput>)}
          onBulkDelete={bulkDeleteCases}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
        />
      </div>

      <CaseDrawer
        key={drawerState === null ? "closed" : drawerState.mode === "view" ? drawerState.testCase.id : "new"}
        open={drawerState !== null}
        onClose={closeDrawer}
        existing={drawerState?.mode === "view" ? drawerState.testCase : null}
        initialTitle={drawerState?.mode === "create" ? prefillTitle : undefined}
        defaultSuiteId={selectedSuiteId === "all" ? null : selectedSuiteId}
        suites={suites}
        projectCode={activeProject?.code ?? ""}
        history={
          drawerState?.mode === "view" ? historyByCase[drawerState.testCase.id] ?? [] : []
        }
        onCreate={async (input) => {
          const created = await createCase(input as unknown as TestCaseInput);
          if (created && jiraQueueItemId) {
            await supabase.from("jira_queue_items").update({ created_test_case_id: created.id }).eq("id", jiraQueueItemId);
            setJiraQueueItemId(undefined);
          }
          setPrefillTitle(undefined);
        }}
        onSave={async (id, input) => {
          await updateCase(id, input as unknown as Partial<TestCaseInput>);
        }}
        onDuplicate={async (testCase) => {
          await duplicateCase(testCase);
          closeDrawer();
        }}
        onDelete={deleteCase}
      />

      <ImportCsvModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        suites={suites}
        onConfirm={async (result, suiteId) => {
          await bulkCreateCases(result.cases, suiteId);
        }}
      />
    </div>
  );
}

export { TestCasesPage };
