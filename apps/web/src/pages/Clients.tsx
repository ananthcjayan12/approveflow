import { MoreHorizontal, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Topbar } from '../components/Topbar';
import { clients } from '../lib/demo';

export function ClientsList() {
  return <><Topbar/><div className="page-pad"><PageHeader eyebrow="RELATIONSHIPS" title="Clients" action={<Link to="/app/clients/new" className="button button-primary"><Plus size={16}/> New client</Link>}/><div className="panel"><div className="toolbar"><div className="search wide"><Search size={17}/><input placeholder="Search clients…"/></div></div><div className="client-list">{clients.map((c, i) => <Link key={c.id} to={`/app/clients/${c.id}`} className="client-row"><div className={`client-badge badge-${i}`}>{c.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div className="grow"><b>{c.name}</b><span>{c.contact} · {c.email}</span></div><div><b>{c.projects}</b><span>projects</span></div><div><b>{c.assets}</b><span>assets</span></div><button className="icon-button"><MoreHorizontal/></button></Link>)}</div></div></div></>;
}

export function ClientForm() {
  return <><Topbar/><div className="page-pad narrow"><PageHeader eyebrow="CLIENT" title="Create a new client"/><form className="panel form-panel"><label>Company name<input placeholder="e.g. SmileCraft Dental"/></label><div className="form-grid"><label>Contact name<input placeholder="Primary reviewer"/></label><label>Email address<input type="email" placeholder="client@example.com"/></label></div><label>Logo<div className="upload-mini">Upload logo <small>PNG, JPG or SVG</small></div></label><label>Notes<textarea placeholder="Anything your team should remember about this client…"/></label><div className="form-actions"><Link to="/app/clients" className="button button-ghost">Cancel</Link><Link to="/app/clients" className="button button-primary">Create client</Link></div></form></div></>;
}
