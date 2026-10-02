export interface TestSuite {
  id: string;
  project_id: string;
  parent_suite_id: string | null;
  title: string;
  description: string | null;
  position: number;
  created_at: string;
}

export type Priority = "low" | "medium" | "high" | "critical";
export type Severity = "minor" | "normal" | "major" | "critical";
export type TestType =
  | "functional"
  | "regression"
  | "smoke"
  | "integration"
  | "e2e"
  | "performance"
  | "security"
  | "usability"
  | "other";
export type AutomationStatus = "manual" | "automated" | "to_automate";
export type CaseStatus = "active" | "draft" | "deprecated";
export type RunCaseStatus = "untested" | "passed" | "failed" | "blocked" | "skipped" | "pre_existing";

export interface TestCase {
  id: string;
  seq: number;
  project_id: string;
  suite_id: string | null;
  title: string;
  description: string;
  preconditions: string | null;
  postconditions: string;
  repro_steps: string;
  priority: Priority;
  severity: Severity;
  type: TestType;
  status: CaseStatus;
  automation_status: AutomationStatus;
  automation_script_path: string | null;
  tags: string[];
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type TestCaseInput = Pick<
  TestCase,
  | "title"
  | "suite_id"
  | "description"
  | "preconditions"
  | "repro_steps"
  | "postconditions"
  | "priority"
  | "severity"
  | "type"
  | "automation_status"
  | "automation_script_path"
  | "status"
>;
