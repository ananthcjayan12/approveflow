import { ComponentType, Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { WorkspaceProvider } from "./lib/workspace";

// Route-level code splitting: a client opening a review link downloads the review
// screen only — not the marketing site or the agency dashboard.
const site = () => import("./pages/site-pages");
const agency = () => import("./pages/agency-pages");
const pick = <K extends string>(load: () => Promise<Record<K, ComponentType<any>>>, key: K) =>
  lazy(() => load().then((m) => ({ default: m[key] })));

const Landing = pick(site, "Landing");
const Pricing = pick(site, "Pricing");
const Login = pick(site, "Login");
const Signup = pick(site, "Signup");
const Verify = pick(site, "Verify");
const Onboarding = pick(site, "Onboarding");
const ClientReview = lazy(() => import("./pages/ClientReview"));

const AppShell = pick(agency, "AppShell");
const Dashboard = pick(agency, "Dashboard");
const ClientsList = pick(agency, "ClientsList");
const ClientForm = pick(agency, "ClientForm");
const ClientDetail = pick(agency, "ClientDetail");
const ProjectsList = pick(agency, "ProjectsList");
const ProjectForm = pick(agency, "ProjectForm");
const ProjectDetail = pick(agency, "ProjectDetail");
const UploadContent = pick(agency, "UploadContent");
const ApprovalNew = pick(agency, "ApprovalNew");
const ActivityPage = pick(agency, "ActivityPage");
const AgencyAssetReview = pick(agency, "AgencyAssetReview");
const BillingSettings = pick(agency, "BillingSettings");
const NotificationSettings = pick(agency, "NotificationSettings");
const StoragePage = pick(agency, "StoragePage");
const WorkspaceSettings = pick(agency, "WorkspaceSettings");

function Loading() {
  return (
    <div className="center-page">
      <div className="loading" role="status" aria-label="Loading">
        <span className="spinner" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
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
          <Route path="settings" element={<Navigate to="workspace" replace />} />
          <Route path="settings/workspace" element={<WorkspaceSettings />} />
          <Route path="settings/notifications" element={<NotificationSettings />} />
          <Route path="settings/billing" element={<BillingSettings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
