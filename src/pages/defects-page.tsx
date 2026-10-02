import { useParams } from "react-router-dom";
import { DefectListPage } from "@/pages/defects/defect-list-page";
import { DefectDetailPage } from "@/pages/defects/defect-detail-page";

function DefectsPage() {
  const { id } = useParams();
  return id ? <DefectDetailPage defectId={id} /> : <DefectListPage />;
}

export { DefectsPage };
