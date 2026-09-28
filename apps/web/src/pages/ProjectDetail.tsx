import { ExternalLink, MoreHorizontal, Plus, Share2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { StatusPill } from '../components/StatusPill';
import { Topbar } from '../components/Topbar';
import { assets, clients, projects } from '../lib/demo';

export default function ProjectDetail() {
  const { id } = useParams(); const project = projects.find(p=>p.id===id)||projects[0]; const client=clients.find(c=>c.id===project.clientId)!; const mine=assets.filter(a=>a.projectId===project.id);
  return <><Topbar/><div className="page-pad"><div className="project-heading"><div><div className="eyebrow">{client.name}</div><h1>{project.name}</h1><p>{mine.length} assets · Review requested by {project.due}</p></div><div className="project-actions"><Link className="button button-ghost" to="/review/demo"><ExternalLink size={16}/> Preview client view</Link><Link className="button button-primary" to="/app/approvals/new"><Share2 size={16}/> Send for approval</Link></div></div><div className="tabbar"><button className="active">Assets ({mine.length})</button><button>Comments</button><button>Activity</button><button>Settings</button></div><div className="asset-toolbar"><div className="filter-pills"><button className="active">All</button><button>Waiting</button><button>Approved</button><button>Changes</button></div><Link to="/app/upload" className="button button-primary small"><Plus size={15}/> Add assets</Link></div><div className="asset-grid">{mine.map(asset=><Link key={asset.id} to={`/app/assets/${asset.id}`} className="asset-card"><div className="asset-media">{asset.kind==='video'?<video src={asset.src} muted/>:<img src={asset.src} alt=""/>}<span className="asset-kind">{asset.kind}</span></div><div className="asset-card-info"><div><b>{asset.name}</b><span>{asset.caption}</span></div><MoreHorizontal size={18}/></div><StatusPill status={asset.status}/></Link>)}</div></div></>;
}
