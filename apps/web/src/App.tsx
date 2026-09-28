import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import ActivityPage from './pages/ActivityPage';
import AgencyAssetReview from './pages/AgencyAssetReview';
import ApprovalNew from './pages/ApprovalNew';
import { Login, Signup, Verify } from './pages/AuthPages';
import ClientDetail from './pages/ClientDetail';
import { ClientForm, ClientsList } from './pages/Clients';
import ClientReview from './pages/ClientReview';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Pricing from './pages/Pricing';
import ProjectDetail from './pages/ProjectDetail';
import { ProjectForm, ProjectsList } from './pages/Projects';
import { BillingSettings, NotificationSettings, WorkspaceSettings } from './pages/SettingsPages';
import StoragePage from './pages/StoragePage';
import UploadContent from './pages/UploadContent';

export default function App(){return <Routes>
  <Route path="/" element={<Landing/>}/>
  <Route path="/signup" element={<Signup/>}/>
  <Route path="/login" element={<Login/>}/>
  <Route path="/verify" element={<Verify/>}/>
  <Route path="/onboarding" element={<Onboarding/>}/>
  <Route path="/pricing" element={<Pricing/>}/>
  <Route path="/review/:token" element={<ClientReview/>}/>
  <Route path="/app" element={<AppShell/>}>
    <Route index element={<Navigate to="dashboard" replace/>}/>
    <Route path="dashboard" element={<Dashboard/>}/>
    <Route path="clients" element={<ClientsList/>}/>
    <Route path="clients/new" element={<ClientForm/>}/>
    <Route path="clients/:id" element={<ClientDetail/>}/>
    <Route path="projects" element={<ProjectsList/>}/>
    <Route path="projects/new" element={<ProjectForm/>}/>
    <Route path="projects/:id" element={<ProjectDetail/>}/>
    <Route path="assets/:id" element={<AgencyAssetReview/>}/>
    <Route path="approvals/new" element={<ApprovalNew/>}/>
    <Route path="upload" element={<UploadContent/>}/>
    <Route path="activity" element={<ActivityPage/>}/>
    <Route path="storage" element={<StoragePage/>}/>
    <Route path="settings/workspace" element={<WorkspaceSettings/>}/>
    <Route path="settings/notifications" element={<NotificationSettings/>}/>
    <Route path="settings/billing" element={<BillingSettings/>}/>
  </Route>
  <Route path="*" element={<Navigate to="/" replace/>}/>
</Routes>}
