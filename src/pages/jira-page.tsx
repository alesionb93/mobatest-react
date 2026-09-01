import { useParams } from "react-router-dom";
import { JiraListPage } from "@/pages/jira/jira-list-page";
import { JiraDetailPage } from "@/pages/jira/jira-detail-page";

function JiraPage() {
  const { id } = useParams();
  return id ? <JiraDetailPage itemId={id} /> : <JiraListPage />;
}

export { JiraPage };
