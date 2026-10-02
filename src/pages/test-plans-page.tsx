import * as React from "react";
import { ClipboardList, Plus } from "lucide-react";
import { useProject } from "@/contexts/project-context";
import { useTestPlansData } from "@/pages/test-plans/use-test-plans-data";
import { PlanModal } from "@/pages/test-plans/plan-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import type { TestPlan } from "@/types/test-plans";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function TestPlansPage() {
  const { activeProject } = useProject();
  const { loading, plans, cases, suites, savePlan, deletePlan } = useTestPlansData();
  const [modalState, setModalState] = React.useState<{ open: boolean; plan: TestPlan | null }>({
    open: false,
    plan: null,
  });

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Planos de teste</h1>
          <p className="text-sm text-muted-foreground">
            {plans.length} plano(s) de teste — agrupamentos reutilizáveis de casos.
          </p>
        </div>
        <Button onClick={() => setModalState({ open: true, plan: null })}>
          <Plus size={14} /> Novo plano
        </Button>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={ClipboardList}
            message="Nenhum plano de teste ainda. Agrupe casos relacionados para organizar ciclos de teste."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className="cursor-pointer hover:border-ring transition-colors"
              onClick={() => setModalState({ open: true, plan })}
            >
              <CardContent className="p-4 flex flex-col gap-2">
                <p className="font-semibold text-sm text-foreground truncate">{plan.title}</p>
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5em]">
                  {plan.description || "Sem descrição."}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>{plan.test_plan_cases.length} caso(s)</span>
                  <span>{formatDate(plan.created_at)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PlanModal
        open={modalState.open}
        onClose={() => setModalState({ open: false, plan: null })}
        existing={modalState.plan}
        suites={suites}
        cases={cases}
        projectCode={activeProject?.code ?? ""}
        onSave={savePlan}
        onDelete={deletePlan}
      />
    </div>
  );
}

export { TestPlansPage };
