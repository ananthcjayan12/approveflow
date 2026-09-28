import { Bell, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Topbar() {
  return (
    <div className="topbar">
      <div className="search"><Search size={17}/><input placeholder="Search clients, projects, assets…" /></div>
      <div className="topbar-actions"><button className="icon-button"><Bell size={18}/></button><Link className="button button-primary small" to="/app/approvals/new"><Plus size={16}/> New approval</Link><div className="avatar small">AJ</div></div>
    </div>
  );
}
