export interface TestPlan {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  test_plan_cases: { test_case_id: string }[];
}

export interface PlanCaseRef {
  id: string;
  title: string;
  seq: number;
  suite_id: string | null;
}
