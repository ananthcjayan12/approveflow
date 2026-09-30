import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, FolderOpen, Send, Upload, UploadCloud } from "lucide-react";
import { EmptyState, PageHeader, ProgressBar, StatusBadge, Thumb } from "../components/ui";
import { formatDate, isWaiting, kindLabel } from "../lib/format";
import { AssetRow, useWorkspace } from "../lib/workspace";

const filters: Array<{ key: string; label: string; match: (a: AssetRow) => boolean }> = [
  { key: "all", label: "All", match: () => true },
  { key: "draft", label: "Not sent yet", match: (a) => a.status === "draft" },
  { key: "waiting", label: "Waiting", match: (a) => isWaiting(a.status) },
  { key: "changes", label: "Changes needed", match: (a) => a.status === "changes_requested" },
  { key: "approved", label: "Approved", match: (a) => a.status === "approved" },
];

export default function ProjectDetail() {
  const { id } = useParams();
  const { projects, assets } = useWorkspace();
  const [filter, setFilter] = useState("all");
  const project = projects.find((p) => p.id === id);
  if (!project)
    return (
      <EmptyState
        icon={<FolderOpen size={26} />}
        title="Project not found"
        body="It may have been removed."
        action={<Link className="button button-secondary" to="/app/projects">Back to projects</Link>}
      />
    );
  const mine = assets.filter((a) => a.project_id === id);
  const approved = mine.filter((a) => a.status === "approved").length;
  const active = filters.find((f) => f.key === filter) ?? filters[0];
  const shown = mine.filter(active.match);
  return (
    <>
      <PageHeader
        back={{ to: "/app/projects", label: "Projects" }}
        title={project.name}
        description={
          <>
            <Link className="link" to={`/app/clients/${project.client_id}`}>
              {project.company_name}
            </Link>
            {project.due_at && (
              <span className="inline-meta">
                <CalendarDays size={14} /> Due {formatDate(project.due_at)}
              </span>
            )}
          </>
        }
        action={
          mine.length > 0 && (
            <>
              <Link className="button button-secondary" to={`/app/upload?project=${id}`}>
                <Upload size={16} /> Upload
              </Link>
              <Link className="button button-primary" to={`/app/approvals/new?project=${id}`}>
                <Send size={16} /> Send for approval
              </Link>
            </>
          )
        }
      />
      {project.description && <p className="lead">{project.description}</p>}

      {mine.length === 0 ? (
        <Link className="dropzone dropzone-link" to={`/app/upload?project=${id}`}>
          <span className="dropzone-icon">
            <UploadCloud size={28} />
          </span>
          <b>Upload your first files</b>
          <span>Images, videos or PDFs. Then send them to your client in one click.</span>
          <span className="button button-primary">Choose files</span>
        </Link>
      ) : (
        <>
          <div className="card summary-card">
            <div>
              <b>
                {approved} of {mine.length} approved
              </b>
              <span>
                {approved === mine.length ? "Everything is approved — nice work!" : "Keep going — you’re getting there."}
              </span>
            </div>
            <ProgressBar value={(approved / mine.length) * 100} tone="green" label="Approved" />
          </div>
          <div className="toolbar-row">
            <div className="segmented" role="tablist" aria-label="Filter files">
              {filters.map((f) => {
                const count = mine.filter(f.match).length;
                if (f.key !== "all" && !count) return null;
                return (
                  <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}>
                    {f.label} <span>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="asset-grid">
            {shown.map((a) => (
              <Link className="asset-card" key={a.id} to={`/app/assets/${a.id}`}>
                <div className="thumb thumb-card">
                  <Thumb asset={a} badge />
                  <span className="thumb-corner">
                    <StatusBadge status={a.status} />
                  </span>
                  {a.latest_version_no > 1 && <span className="thumb-ver">v{a.latest_version_no}</span>}
                </div>
                <div className="asset-card-body">
                  <b title={a.name}>{a.name}</b>
                  <span>{kindLabel[a.kind] ?? a.kind}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
