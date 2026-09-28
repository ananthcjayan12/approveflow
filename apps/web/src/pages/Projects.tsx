import { Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { StatusPill } from '../components/StatusPill';
import { Topbar } from '../components/Topbar';
import { clients, projects } from '../lib/demo';

export function ProjectsList() {
  return <><Topbar/><div className="page-pad"><PageHeader eyebrow="CAMPAIGNS" title="Projects" action={<Link to="/app/projects/new" className="button button-primary"><Plus size={16}/> New project</Link>}/><div className="panel"><div className="toolbar"><div className="search wide"><Search size={17}/><input placeholder="Search projects…"/></div><select><option>All clients</option></select><select><option>All statuses</option></select></div><div className="table-grid"><div className="table-head"><span>Project</span><span>Client</span><span>Assets</span><span>Due</span><span>Status</span></div>{projects.map(p => { const c=clients.find(x=>x.id===p.clientId)!; return <Link to={`/app/projects/${p.id}`} className="table-row" key={p.id}><b>{p.name}</b><span>{c.name}</span><span>{p.approved+p.changes+p.waiting}</span><span>{p.due}</span><StatusPill status={p.status}/></Link>})}</div></div></div></>;
}

export function ProjectForm() {
 return <><Topbar/><div className="page-pad narrow"><PageHeader eyebrow="PROJECT" title="Create a new project"/><form className="panel form-panel"><label>Project name<input placeholder="October Content"/></label><label>Client<select><option>SmileCraft Dental</option><option>Milano Trips</option></select></label><label>Description<textarea placeholder="What is this campaign for?"/></label><div className="form-grid"><label>Due date<input type="date"/></label><label>Approval mode<select><option>Approve each item</option><option>Approve entire campaign</option></select></label></div><div className="form-actions"><Link to="/app/projects" className="button button-ghost">Cancel</Link><Link to="/app/projects/october" className="button button-primary">Create project</Link></div></form></div></>;
}
