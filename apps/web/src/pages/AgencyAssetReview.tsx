import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Image as ImageIcon, Send, Upload } from "lucide-react";
import { FeedbackPanel } from "../components/FeedbackPanel";
import { EmptyState, Notice, PageHeader, StatusBadge } from "../components/ui";
import { api } from "../lib/api";
import { kindLabel } from "../lib/format";
import { CommentRow, useWorkspace } from "../lib/workspace";

export default function AgencyAssetReview() {
  const { id } = useParams();
  const { assets, projects } = useWorkspace();
  const asset = assets.find((a) => a.id === id);
  const project = projects.find((p) => p.id === asset?.project_id);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setComments(await api<CommentRow[]>(`/api/assets/${id}/comments`));
  }, [id]);
  useEffect(() => {
    void load().catch((e) => setMessage(e.message));
  }, [load]);
  if (!asset)
    return (
      <EmptyState
        icon={<ImageIcon size={26} />}
        title="File not found"
        body="It may have been removed."
        action={<Link className="button button-secondary" to="/app/projects">Back to projects</Link>}
      />
    );
  const needsChanges = asset.status === "changes_requested";
  const draft = asset.status === "draft";
  return (
    <>
      <PageHeader
        back={project ? { to: `/app/projects/${project.id}`, label: project.name } : { to: "/app/projects", label: "Projects" }}
        title={asset.name}
        description={
          <span className="inline-meta">
            <StatusBadge status={asset.status} />
            {kindLabel[asset.kind] ?? asset.kind} · Version {asset.latest_version_no}
          </span>
        }
        action={
          <>
            <Link
              className={`button ${needsChanges ? "button-primary" : "button-secondary"}`}
              to={`/app/upload?asset=${id}`}
            >
              <Upload size={16} /> Upload new version
            </Link>
            {draft && (
              <Link className="button button-primary" to={`/app/approvals/new?project=${asset.project_id}&assets=${id}`}>
                <Send size={16} /> Send for approval
              </Link>
            )}
          </>
        }
      />
      {needsChanges && (
        <p className="hint-box warn">
          Your client asked for changes. Read their comments, then upload a new version — they’ll see it on the same link.
        </p>
      )}
      <Notice message={message} tone="error" />
      <FeedbackPanel
        key={asset.version_id}
        asset={asset}
        comments={comments}
        canComment={!draft}
        disabledReason="Send this file for approval to start a conversation with your client."
        onSave={load}
      />
    </>
  );
}
