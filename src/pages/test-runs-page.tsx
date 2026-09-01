import { useParams } from "react-router-dom";
import { RunListPage } from "@/pages/test-runs/run-list-page";
import { RunDetailPage } from "@/pages/test-runs/run-detail-page";

function TestRunsPage() {
  const { id } = useParams();
  return id ? <RunDetailPage runId={id} /> : <RunListPage />;
}

export { TestRunsPage };
