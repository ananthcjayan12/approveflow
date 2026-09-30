import { CalendarDays, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate, isWaiting } from "../lib/format";
import { ProjectRow as Project, useWorkspace } from "../lib/workspace";

export function ProjectRow({ project, showClient = true }: { project: Project; showClient?: boolean }) {
  const { assets } = useWorkspace();
  const mine = assets.filter((a) => a.project_id === project.id);
  const approved = mine.filter((a) => a.status === "approved").length;
  const changes = mine.filter((a) => a.status === "changes_requested").length;
  const waiting = mine.filter((a) => isWaiting(a.status)).length;
  const drafts = mine.length - approved - changes - waiting;
  return (
    <Link className="project-row" to={`/app/projects/${project.id}`}>
      <div className="project-row-main">
        <b>{project.name}</b>
        <span>
          {showClient && `${project.company_name} · `}
          {mine.length} {mine.length === 1 ? "file" : "files"}
          {project.due_at && (
            <>
              {" · "}
              <CalendarDays size={13} /> Due {formatDate(project.due_at)}
            </>
          )}
        </span>
      </div>
      <div className="project-row-status">
        {mine.length > 0 ? (
          <>
            <div className="mini-tags">
              {changes > 0 && <span className="tag tone-red">{changes} changes</span>}
              {waiting > 0 && <span className="tag tone-amber">{waiting} waiting</span>}
              <span className="tag tone-green">
                {approved}/{mine.length} approved
              </span>
            </div>
            <div className="segbar" role="img" aria-label={`${approved} approved, ${waiting} waiting, ${changes} need changes, ${drafts} not sent`}>
              {approved > 0 && <i className="s-green" style={{ flex: approved }} />}
              {waiting > 0 && <i className="s-amber" style={{ flex: waiting }} />}
              {changes > 0 && <i className="s-red" style={{ flex: changes }} />}
              {drafts > 0 && <i className="s-gray" style={{ flex: drafts }} />}
            </div>
          </>
        ) : (
          <span className="muted small">No files yet</span>
        )}
      </div>
      <ChevronRight size={18} className="chevron" />
    </Link>
  );
}
