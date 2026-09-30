import {
  Activity,
  ChevronsUpDown,
  CreditCard,
  FolderOpen,
  HardDrive,
  Home,
  LogOut,
  Plus,
  Search,
  Send,
  Settings,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Brand } from "./Brand";
import { CommandPalette } from "./CommandPalette";
import { Popover } from "./Popover";
import { ThemePicker, ThemeToggle } from "./ThemeToggle";
import { Avatar, ProgressBar } from "./ui";
import { isTyping, useMediaQuery, useWindowKey } from "../lib/hooks";
import { formatBytes } from "../lib/format";
import { useWorkspace } from "../lib/workspace";
import { api } from "../lib/api";

const items = [
  { to: "/app/dashboard", Icon: Home, label: "Home" },
  { to: "/app/clients", Icon: Users, label: "Clients" },
  { to: "/app/projects", Icon: FolderOpen, label: "Projects" },
  { to: "/app/activity", Icon: Activity, label: "Activity" },
];

const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? "nav-item active" : "nav-item");

function AccountMenu({ anchor, open, onClose }: { anchor: HTMLElement | null; open: boolean; onClose: () => void }) {
  const { workspace } = useWorkspace();
  const [error, setError] = useState("");
  const logout = () =>
    void api("/api/auth/logout", { method: "POST" })
      .then(() => window.location.assign("/login"))
      .catch((e) => setError(e.message));
  return (
    <Popover anchor={anchor} open={open} onClose={onClose} side="top" align="start" className="account-menu" label="Account">
      <div className="account-head">
        <Avatar name={workspace.name} color={workspace.brand_color} size="md" />
        <div>
          <b>{workspace.name}</b>
          <span className="capitalize">{workspace.plan_key} plan</span>
        </div>
      </div>
      <div className="menu-sep" />
      <Link className="menu-item" to="/app/settings/workspace" onClick={onClose}>
        <Settings size={16} /> Workspace settings
      </Link>
      <Link className="menu-item" to="/app/settings/billing" onClick={onClose}>
        <CreditCard size={16} /> Plan &amp; billing
      </Link>
      <Link className="menu-item" to="/app/storage" onClick={onClose}>
        <HardDrive size={16} /> Storage
      </Link>
      <div className="menu-sep" />
      <p className="menu-label">Appearance</p>
      <div className="menu-theme">
        <ThemePicker />
      </div>
      <div className="menu-sep" />
      <button className="menu-item danger" onClick={logout}>
        <LogOut size={16} /> Log out
      </button>
      {error && <small role="alert" className="error-text">{error}</small>}
    </Popover>
  );
}

export function AppShell() {
  const { workspace, assets } = useWorkspace();
  const [palette, setPalette] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sideAnchor, setSideAnchor] = useState<HTMLElement | null>(null);
  const [phoneAnchor, setPhoneAnchor] = useState<HTMLElement | null>(null);
  const phone = useMediaQuery("(max-width: 760px)");
  const location = useLocation();

  useEffect(() => {
    setMenu(false);
    setPalette(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  useWindowKey((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      setPalette((v) => !v);
    } else if (e.key === "/" && !isTyping(e.target) && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      setPalette(true);
    }
  });

  const needsAttention = useMemo(() => assets.filter((a) => a.status === "changes_requested").length, [assets]);
  const usedPct = (workspace.storage_used_bytes / Math.max(1, workspace.storage_quota_bytes)) * 100;
  const inSettings = location.pathname.startsWith("/app/settings") || location.pathname === "/app/storage";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/app/dashboard" className="sidebar-brand" aria-label="ApproveFlow home">
          <Brand compact />
        </Link>
        <Link className="button button-primary sidebar-cta" to="/app/approvals/new">
          <Send size={16} /> <span className="nav-text">Send for approval</span>
        </Link>
        <nav aria-label="Main" className="nav">
          <p className="nav-label">Workspace</p>
          {items.map(({ to, Icon, label }) => (
            <NavLink key={to} to={to} className={navClass} data-tip={label} data-tip-pos="right">
              <Icon size={18} strokeWidth={1.9} />
              <span className="nav-text">{label}</span>
              {label === "Home" && needsAttention > 0 && (
                <span className="nav-badge" aria-label={`${needsAttention} need attention`}>{needsAttention}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <Link to="/app/storage" className="storage-mini" aria-label="Storage usage">
            <div>
              <span>Storage</span>
              <b className="tabular">
                {formatBytes(workspace.storage_used_bytes)} <i>of {formatBytes(workspace.storage_quota_bytes)}</i>
              </b>
            </div>
            <ProgressBar value={usedPct} label="Storage used" />
          </Link>
          <button
            ref={setSideAnchor}
            type="button"
            className={`account-btn${inSettings ? " is-active" : ""}`}
            aria-haspopup="dialog"
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
          >
            <Avatar name={workspace.name} color={workspace.brand_color} />
            <span className="account-text nav-text">
              <b>{workspace.name}</b>
              <span className="capitalize">{workspace.plan_key} plan</span>
            </span>
            <ChevronsUpDown size={16} className="nav-text" />
          </button>
        </div>
      </aside>

      <header className="mobile-header">
        <Link to="/app/dashboard" aria-label="ApproveFlow home">
          <Brand compact />
        </Link>
        <div className="mobile-actions">
          <button className="icon-button ghost large" aria-label="Search" onClick={() => setPalette(true)}>
            <Search size={20} />
          </button>
          <button
            ref={setPhoneAnchor}
            className="avatar-button"
            aria-label="Account menu"
            aria-haspopup="dialog"
            onClick={() => setMenu((v) => !v)}
          >
            <Avatar name={workspace.name} color={workspace.brand_color} />
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="topbar">
          <button className="search-trigger" onClick={() => setPalette(true)} aria-label="Search clients, projects and files">
            <Search size={16} />
            <span>Search or jump to…</span>
            <kbd>⌘K</kbd>
          </button>
          <ThemeToggle />
        </div>
        <div className="page">
          <Outlet />
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Main">
        <NavLink to="/app/dashboard" className={navClass}>
          <Home size={21} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/app/clients" className={navClass}>
          <Users size={21} />
          <span>Clients</span>
        </NavLink>
        <Link to="/app/approvals/new" className="bottom-fab" aria-label="Send for approval">
          <span>
            <Plus size={26} strokeWidth={2.4} />
          </span>
          <b>Send</b>
        </Link>
        <NavLink to="/app/projects" className={navClass}>
          <FolderOpen size={21} />
          <span>Projects</span>
        </NavLink>
        <NavLink to="/app/activity" className={navClass}>
          <Activity size={21} />
          <span>Activity</span>
        </NavLink>
      </nav>

      <AccountMenu anchor={phone ? phoneAnchor : sideAnchor} open={menu} onClose={() => setMenu(false)} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </div>
  );
}
