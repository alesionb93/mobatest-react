import * as React from "react";
import { LayoutDashboard } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { Skeleton, EmptyState } from "@/components/ui/skeleton";
import { useDashboardData } from "@/pages/dashboard/use-dashboard-data";
import { DateFilterBar, type PresetKey } from "@/pages/dashboard/date-filter-bar";
import { OverviewTab } from "@/pages/dashboard/overview-tab";
import { DefectsTab } from "@/pages/dashboard/defects-tab";
import { RunsTab } from "@/pages/dashboard/runs-tab";

const TABS = [
  { key: "overview", label: "Visão geral" },
  { key: "defects", label: "Defeitos" },
  { key: "runs", label: "Execuções" },
];

function DashboardPage() {
  const { loading, data } = useDashboardData();
  const [tab, setTab] = React.useState("overview");
  const [dateFrom, setDateFrom] = React.useState<string | null>(null);
  const [dateTo, setDateTo] = React.useState<string | null>(null);
  const [preset, setPreset] = React.useState<PresetKey>("all");

  function handlePresetChange(p: PresetKey) {
    setPreset(p);
    if (p === "all") {
      setDateFrom(null);
      setDateTo(null);
    } else if (p) {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - parseInt(p, 10));
      setDateTo(to.toISOString().slice(0, 10));
      setDateFrom(from.toISOString().slice(0, 10));
    }
  }

  function inRange(iso: string | null) {
    if (!iso) return false;
    const d = iso.slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <EmptyState
          icon={LayoutDashboard}
          message="Crie seu primeiro projeto para começar a acompanhar a qualidade do seu produto."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        <DateFilterBar
          dateFrom={dateFrom}
          dateTo={dateTo}
          preset={preset}
          onChangePreset={handlePresetChange}
          onChangeRange={(from, to) => {
            setDateFrom(from);
            setDateTo(to);
          }}
        />
      </div>

      {tab === "overview" && <OverviewTab data={data} inRange={inRange} />}
      {tab === "defects" && <DefectsTab data={data} inRange={inRange} />}
      {tab === "runs" && <RunsTab data={data} inRange={inRange} />}
    </div>
  );
}

export { DashboardPage };
