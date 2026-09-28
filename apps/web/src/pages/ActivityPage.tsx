import { CheckCircle2, Eye, Mail, MessageSquare, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Topbar } from '../components/Topbar';

const rows=[
  [CheckCircle2,'Dr. Priya approved Instagram Post 1','SmileCraft · October Content','18 min ago'],
  [MessageSquare,'Dr. Priya requested changes on Carousel','2 visual annotations','24 min ago'],
  [Eye,'Rohan viewed Diwali Campaign','Milano Trips','52 min ago'],
  [Mail,'Reminder sent','SmileCraft · 2 items waiting','1 hour ago'],
  [RefreshCw,'Version 2 uploaded','Summer Collection','3 hours ago']
] as const;
export default function ActivityPage(){return <><Topbar/><div className="page-pad"><PageHeader eyebrow="AUDIT TRAIL" title="Activity"/><div className="panel activity-page-list">{rows.map(([Icon,title,sub,time])=><div className="activity-row" key={title}><span className="activity-icon"><Icon/></span><div className="grow"><b>{title}</b><span>{sub}</span></div><time>{time}</time></div>)}</div></div></>}
