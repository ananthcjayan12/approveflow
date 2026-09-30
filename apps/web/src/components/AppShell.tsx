import {
  Activity,
  FolderOpen,
  Home,
  LogOut,
  Send,
  Settings,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Brand } from "./Brand";
import { Topbar } from "./Topbar";
import { Avatar } from "./ui";
import { useWorkspace } from "../lib/workspace";
import { api } from "../lib/api";

const items = [
  { to: "/app/dashboard", Icon: Home, label: "Home" },
  { to: "/app/clients", Icon: Users, label: "Clients" },
  { to: "/app/projects", Icon: FolderOpen, label: "Projects" },
  { to: "/app/activity", Icon: Activity, label: "Activity" },
];
const settings = { to: "/app/settings/workspace", Icon: Settings, label: "Settings" };

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "nav-item active" : "nav-item";

export function AppShell() {
  const { workspace } = useWorkspace();
  const [error, setError] = useState("");
  const inSettings = useLocation().pathname.startsWith("/app/settings");
  const settingsClass = () => navClass({ isActive: inSettings });
  const logout = () =>
    void api("/api/auth/logout", { method: "POST" })
      .then(() => window.location.assign("/login"))
      .catch((e) => setError(e.message));
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/app/dashboard" className="sidebar-brand">
          <Brand compact />
        </Link>
        <Link className="button button-primary sidebar-cta" to="/app/approvals/new">
          <Send size={16} /> Send for approval
        </Link>
        <nav aria-label="Main">
          {items.map(({ to, Icon, label }) => (
            <NavLink key={to} to={to} className={navClass}>
              <Icon size={19} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink
            to={settings.to}
            className={settingsClass}
          >
            <settings.Icon size={19} /> {settings.label}
          </NavLink>
          <div className="account">
            <Avatar name={workspace.name} color={workspace.brand_color} />
            <div className="account-text">
              <b>{workspace.name}</b>
              <span>{workspace.plan_key} plan</span>
            </div>
            <button className="icon-button" aria-label="Log out" title="Log out" onClick={logout}>
              <LogOut size={17} />
            </button>
          </div>
          {error && <small role="alert" className="error-text">{error}</small>}
        </div>
      </aside>

      <header className="mobile-header">
        <Link to="/app/dashboard">
          <Brand compact />
        </Link>
        <Link className="button button-primary small" to="/app/approvals/new">
          <Send size={15} /> Send
        </Link>
      </header>

      <main className="app-main">
        <Topbar />
        <div className="page">
          <Outlet />
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Main">
        {[...items, settings].map(({ to, Icon, label }) => (
          <NavLink key={to} to={to} className={to === settings.to ? settingsClass : navClass}>
            <Icon size={21} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
