import { Activity, Bell, CreditCard, FolderKanban, Gauge, HardDrive, Settings, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { Brand } from './Brand';

const items = [
  ['/app/dashboard', Gauge, 'Dashboard'],
  ['/app/clients', Users, 'Clients'],
  ['/app/projects', FolderKanban, 'Projects'],
  ['/app/activity', Activity, 'Activity'],
  ['/app/storage', HardDrive, 'Storage'],
  ['/app/settings/notifications', Bell, 'Notifications'],
  ['/app/settings/billing', CreditCard, 'Billing'],
  ['/app/settings/workspace', Settings, 'Settings']
] as const;

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><Brand compact /></div>
        <nav>
          {items.map(([to, Icon, label]) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Icon size={18} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-account">
          <div className="avatar">PA</div>
          <div><strong>Pixel Agency</strong><span>Freelancer plan</span></div>
        </div>
      </aside>
      <main className="app-main"><Outlet /></main>
    </div>
  );
}
