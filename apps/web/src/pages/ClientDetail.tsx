import { Edit3, Plus } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { MetricCard } from '../components/MetricCard';
import { StatusPill } from '../components/StatusPill';
import { Topbar } from '../components/Topbar';
import { clients, projects } from '../lib/demo';

export default function ClientDetail() {
  const { id } = useParams(); const client = clients.find(c => c.id === id) || clients[0]; const mine = projects.filter(p => p.clientId === client.id);
  return <><Topbar/><div className="page-pad"><div className="client-hero"><div className="client-badge big">{client.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div className="grow"><div className="eyebrow">CLIENT</div><h1>{client.name}</h1><p>{client.contact} · {client.email}</p></div><button className="button button-ghost"><Edit3 size={16}/> Edit client</button></div><div className="metrics-grid"><MetricCard value={client.projects} label="Active projects"/><MetricCard value={4} label="Waiting approvals"/><MetricCard value={18} label="Approved"/><MetricCard value={2} label="Changes requested"/></div><section className="panel"><div className="panel-head"><div><h2>Projects</h2><p>{client.note || 'Projects and approval history for this client.'}</p></div><Link className="button button-primary small" to="/app/projects/new"><Plus size={15}/> New project</Link></div><div className="list-table">{mine.length ? mine.map(p => <Link key={p.id} to={`/app/projects/${p.id}`} className="project-row"><div className="thumb-letter">{p.name[0]}</div><div className="grow"><b>{p.name}</b><span>{p.approved+p.changes+p.waiting} assets · due {p.due}</span></div><StatusPill status={p.status}/></Link>) : <div className="empty-inline">No projects yet.</div>}</div></section></div></>;
}
