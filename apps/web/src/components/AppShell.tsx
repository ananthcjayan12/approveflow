import {
  Activity,
  Bell,
  CreditCard,
  FolderKanban,
  Gauge,
  HardDrive,
  Settings,
  Users,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { Brand } from "./Brand";
import { useWorkspace } from "../lib/workspace";
import { api } from "../lib/api";
import { useState } from "react";

const items = [
  ["/app/dashboard", Gauge, "Dashboard"],
  ["/app/clients", Users, "Clients"],
  ["/app/projects", FolderKanban, "Projects"],
  ["/app/activity", Activity, "Activity"],
  ["/app/storage", HardDrive, "Storage"],
  ["/app/settings/notifications", Bell, "Notifications"],
  ["/app/settings/billing", CreditCard, "Billing"],
  ["/app/settings/workspace", Settings, "Settings"],
] as const;

export function AppShell() {
  const { workspace } = useWorkspace();
  const [error, setError] = useState("");
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Brand compact />
        </div>
        <nav>
          {items.map(([to, Icon, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                isActive ? "nav-item active" : "nav-item"
              }
            >
              <Icon size={18} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-account">
          <div className="avatar">
            {workspace.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <strong>{workspace.name}</strong>
            <span>{workspace.plan_key} plan</span>
            <button
              className="text-button"
              onClick={() =>
                void api("/api/auth/logout", { method: "POST" })
                  .then(() => window.location.assign("/login"))
                  .catch((e) => setError(e.message))
              }
            >
              Log out
            </button>
            {error && <small role="alert">{error}</small>}
          </div>
        </div>
      </aside>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
