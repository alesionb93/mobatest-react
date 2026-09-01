export type DefectStatus = "open" | "in_progress" | "resolved" | "closed";
export type Severity = "minor" | "normal" | "major" | "critical";
export type Priority = "low" | "medium" | "high" | "critical";

export interface Defect {
  id: string;
  seq: number;
  project_id: string;
  title: string;
  description: string | null;
  severity: Severity;
  priority: Priority;
  status: DefectStatus;
  test_run_case_id: string | null;
  test_case_id: string | null;
  reporter_id: string | null;
  assignee_id: string | null;
  failure_reason_id: string | null;
  dev_contact_id: string | null;
  po_contact_id: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  test_cases?: { title: string; seq: number } | null;
}

export interface Attachment {
  id: string;
  defect_id: string;
  storage_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_by: string | null;
  created_at: string;
}

export interface DefectComment {
  id: string;
  defect_id: string;
  user_id: string | null;
  body: string;
  created_at: string;
}
