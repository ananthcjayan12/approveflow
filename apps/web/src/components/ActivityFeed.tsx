import {
  CheckCircle2,
  FolderPlus,
  MessageSquare,
  RefreshCw,
  Send,
  Upload,
  UserPlus,
  AlertCircle,
  Bell,
} from "lucide-react";
import { Link } from "react-router-dom";
import { eventInfo, timeAgo } from "../lib/format";
import { EventRow, useWorkspace } from "../lib/workspace";

const icons: Record<string, typeof Send> = {
  "client.created": UserPlus,
  "project.created": FolderPlus,
  "asset.version_uploaded": Upload,
  "approval.sent": Send,
  "asset.approved": CheckCircle2,
  "asset.changes_requested": AlertCircle,
  "review.comment": MessageSquare,
  "reminder.sent": Bell,
};

export function ActivityItem({ event, count = 1 }: { event: EventRow; count?: number }) {
  const { projects } = useWorkspace();
  const { verb, tone } = eventInfo(event.event_type);
  const Icon = icons[event.event_type] ?? RefreshCw;
  const project = projects.find((p) => p.id === event.project_id);
  const actor = !event.actor_name || event.actor_name === "Owner" ? "You" : event.actor_name;
  return (
    <li className="activity-item">
      <span className={`activity-icon tone-${tone}`}>
        <Icon size={15} />
      </span>
      <div>
        <p>
          <b>{actor}</b> {verb}
          {count > 1 && <span className="repeat"> ×{count}</span>}
          {project && (
            <>
              {" in "}
              <Link to={`/app/projects/${project.id}`}>{project.name}</Link>
            </>
          )}
        </p>
        <time dateTime={event.created_at}>{timeAgo(event.created_at)}</time>
      </div>
    </li>
  );
}

const sameKind = (a: EventRow, b: EventRow) =>
  a.event_type === b.event_type && a.actor_name === b.actor_name && a.project_id === b.project_id;

export function ActivityFeed({ events, limit }: { events: EventRow[]; limit?: number }) {
  const groups: Array<{ event: EventRow; count: number }> = [];
  for (const e of events) {
    const last = groups[groups.length - 1];
    if (last && sameKind(last.event, e)) last.count++;
    else groups.push({ event: e, count: 1 });
  }
  return (
    <ul className="activity-feed">
      {groups.slice(0, limit).map(({ event, count }) => (
        <ActivityItem key={event.id} event={event} count={count} />
      ))}
    </ul>
  );
}
