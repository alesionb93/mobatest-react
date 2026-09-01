import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/auth-context";
import { ProjectProvider } from "@/contexts/project-context";
import { ProtectedRoute } from "@/components/protected-route";
import { AppLayout } from "@/components/layout/app-layout";
import { RequireProject } from "@/components/require-project";

import { LoginPage } from "@/pages/auth/login-page";
import { SignupPage } from "@/pages/auth/signup-page";
import { ForgotPasswordPage } from "@/pages/auth/forgot-password-page";
import { ResetPasswordPage } from "@/pages/auth/reset-password-page";
import { PublicReportPage } from "@/pages/public-report-page";
import { StyleGuidePage } from "@/pages/style-guide-page";

import { DashboardPage } from "@/pages/dashboard-page";
import { TestCasesPage } from "@/pages/test-cases-page";
import { TestPlansPage } from "@/pages/test-plans-page";
import { TestRunsPage } from "@/pages/test-runs-page";
import { JiraPage } from "@/pages/jira-page";
import { DefectsPage } from "@/pages/defects-page";
import { ReportsPage } from "@/pages/reports-page";
import { TeamPage } from "@/pages/team-page";
import { RegistriesPage } from "@/pages/registries-page";
import { ProjectsPage } from "@/pages/projects-page";

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Rotas públicas, sem exigir login */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/report" element={<PublicReportPage />} />
        <Route path="/style-guide" element={<StyleGuidePage />} />

        {/* Rotas autenticadas */}
        <Route element={<ProtectedRoute />}>
          <Route
            element={
              <ProjectProvider>
                <RequireProject />
              </ProjectProvider>
            }
          >
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/test-cases" element={<TestCasesPage />} />
              <Route path="/test-cases/:id" element={<TestCasesPage />} />
              <Route path="/test-plans" element={<TestPlansPage />} />
              <Route path="/test-runs" element={<TestRunsPage />} />
              <Route path="/test-runs/:id" element={<TestRunsPage />} />
              <Route path="/jira" element={<JiraPage />} />
              <Route path="/jira/:id" element={<JiraPage />} />
              <Route path="/defects" element={<DefectsPage />} />
              <Route path="/defects/:id" element={<DefectsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/registries" element={<RegistriesPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
