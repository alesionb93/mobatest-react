export type RunStatus = "active" | "completed" | "cancelled";
export type RunCaseResultStatus = "untested" | "passed" | "failed" | "blocked" | "skipped" | "pre_existing";

export interface TestRun {
  id: string;
  seq: number;
  project_id: string;
  test_plan_id: string | null;
  title: string;
  environment: string | null;
  status: RunStatus;
  is_public: boolean;
  report_token: string;
  report_notes: string;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  cancellation_reason_id: string | null;
}

export interface TestRunListItem extends TestRun {
  test_run_cases: { status: RunCaseResultStatus }[];
}

export interface RunCaseTestCaseInfo {
  title: string;
  seq: number;
  priority: string;
  suite_id: string | null;
  automation_status?: string;
  automation_script_path?: string | null;
  description?: string;
  preconditions?: string | null;
  repro_steps?: string;
  postconditions?: string;
}

export interface TestRunCase {
  id: string;
  test_run_id: string;
  test_case_id: string;
  status: RunCaseResultStatus;
  comment: string | null;
  duration_seconds: number | null;
  executed_by: string | null;
  executed_at: string | null;
  assignee_id: string | null;
  retest_count: number;
  test_cases: RunCaseTestCaseInfo;
}

export interface RunCaseAttempt {
  id: string;
  attempt_number: number;
  status: RunCaseResultStatus;
  comment: string | null;
  duration_seconds: number | null;
  executed_by: string | null;
  executed_at: string | null;
  source: "manual" | "automated";
}

export type AutomatedFailureStatus = "new" | "flaky" | "promoted" | "ignored";

export interface AutomatedFailure {
  id: string;
  test_run_case_id: string;
  project_id: string;
  test_case_title: string;
  occurred_at: string;
  duration_seconds: number | null;
  output: string | null;
  screenshot_path: string | null;
  status: AutomatedFailureStatus;
  defect_id: string | null;
  created_by: string | null;
}

export interface RunDefect {
  id: string;
  seq: number;
  title: string;
  severity: string;
  status: string;
  test_run_case_id: string | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}
