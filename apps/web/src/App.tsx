import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Login, Signup, Verify } from "./pages/AuthPages";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import { WorkspaceProvider } from "./lib/workspace";
import {
  Dashboard,
  ClientsList,
  ClientForm,
  ClientDetail,
  ProjectsList,
  ProjectForm,
  ProjectDetail,
  UploadContent,
  ApprovalNew,
  ActivityPage,
  StoragePage,
  WorkspaceSettings,
  NotificationSettings,
  BillingSettings,
  Onboarding,
} from "./pages/TrialPages";
import { ClientReview, AgencyAssetReview } from "./pages/ReviewPages";
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/verify" element={<Verify />} />
      <Route
        path="/onboarding"
        element={
          <WorkspaceProvider>
            <Onboarding />
          </WorkspaceProvider>
        }
      />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/review/:token" element={<ClientReview />} />
      <Route
        path="/app"
        element={
          <WorkspaceProvider>
            <AppShell />
          </WorkspaceProvider>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="clients" element={<ClientsList />} />
        <Route path="clients/new" element={<ClientForm />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="clients/:id/edit" element={<ClientForm />} />
        <Route path="projects" element={<ProjectsList />} />
        <Route path="projects/new" element={<ProjectForm />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="assets/:id" element={<AgencyAssetReview />} />
        <Route path="upload" element={<UploadContent />} />
        <Route path="approvals/new" element={<ApprovalNew />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="storage" element={<StoragePage />} />
        <Route path="settings/workspace" element={<WorkspaceSettings />} />
        <Route
          path="settings/notifications"
          element={<NotificationSettings />}
        />
        <Route path="settings/billing" element={<BillingSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
