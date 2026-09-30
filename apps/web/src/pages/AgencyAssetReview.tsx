import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Image as ImageIcon, MoreHorizontal, Send, Upload } from "lucide-react";
import { FeedbackPanel } from "../components/FeedbackPanel";
import { Popover } from "../components/Popover";
import { EmptyState, Notice, PageHeader, StatusBadge } from "../components/ui";
import { api } from "../lib/api";
import { kindLabel } from "../lib/format";
import { useMediaQuery } from "../lib/hooks";
import { CommentRow, mediaUrl, useWorkspace } from "../lib/workspace";

export default function AgencyAssetReview() {
  const { id } = useParams();
  const { assets, projects } = useWorkspace();
  const asset = assets.find((a) => a.id === id);
  const project = projects.find((p) => p.id === asset?.project_id);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [message, setMessage] = useState("");
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menu, setMenu] = useState(false);
  const phone = useMediaQuery("(max-width: 760px), (orientation: landscape) and (max-height: 520px)");
  const load = useCallback(async () => {
    setComments(await api<CommentRow[]>(`/api/assets/${id}/comments`));
  }, [id]);
  useEffect(() => {
    void load().catch((e) => setMessage(e.message));
  }, [load]);

  // On a phone the viewer takes the whole screen, so the page underneath must not scroll.
  useEffect(() => {
    if (!phone) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [phone]);

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
  const feedback = comments.filter((c) => c.asset_version_id === asset.version_id && c.author_type !== "owner").length;
  const back = project ? { to: `/app/projects/${project.id}`, label: project.name } : { to: "/app/projects", label: "Projects" };

  const workspace = (
    <FeedbackPanel
      key={asset.version_id}
      asset={asset}
      comments={comments}
      canComment={!draft}
      disabledReason="Send this file for approval to start a conversation with your client."
      onSave={load}
      stageHeader={
        phone ? undefined : (
          <div className="stage-top">
            <div className="stage-title">
              <b>{kindLabel[asset.kind] ?? asset.kind} preview</b>
              <span>What your client sees{asset.latest_version_no > 1 ? ` · Version ${asset.latest_version_no}` : ""}</span>
            </div>
            <div className="stage-actions">
              <a className="icon-button" href={mediaUrl(asset)} target="_blank" rel="noreferrer" aria-label="Open original file" data-tip="Open original">
                <ExternalLink size={16} />
              </a>
            </div>
          </div>
        )
      }
    />
  );

  if (phone)
    return (
      <div className="asset-immersive">
        <header className="asset-bar">
          <Link className="icon-button ghost large" to={back.to} aria-label={`Back to ${back.label}`}>
            <ArrowLeft size={20} />
          </Link>
          <div className="asset-bar-title">
            <h1>{asset.name}</h1>
            <span>
              <StatusBadge status={asset.status} />
              <em>
                {kindLabel[asset.kind] ?? asset.kind} · v{asset.latest_version_no}
                {feedback > 0 && ` · ${feedback} ${feedback === 1 ? "comment" : "comments"}`}
              </em>
            </span>
          </div>
          <button
            ref={setMenuAnchor}
            type="button"
            className={`icon-button ghost large has-dot${needsChanges ? " is-hot" : ""}`}
            aria-label="More actions"
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
          >
            <MoreHorizontal size={20} />
          </button>
        </header>
        {message && <Notice message={message} tone="error" />}
        <div className="asset-immersive-body">{workspace}</div>
        <Popover anchor={menuAnchor} open={menu} onClose={() => setMenu(false)} align="end" className="asset-menu" label="Actions">
          {needsChanges && <p className="menu-note">Your client asked for changes. Upload a new version — they’ll see it on the same link.</p>}
          <Link className="menu-item" to={`/app/upload?asset=${id}`} onClick={() => setMenu(false)}>
            <Upload size={16} /> Upload new version
          </Link>
          {draft && (
            <Link className="menu-item" to={`/app/approvals/new?project=${asset.project_id}&assets=${id}`} onClick={() => setMenu(false)}>
              <Send size={16} /> Send for approval
            </Link>
          )}
          <a className="menu-item" href={mediaUrl(asset)} target="_blank" rel="noreferrer" onClick={() => setMenu(false)}>
            <ExternalLink size={16} /> Open original
          </a>
        </Popover>
      </div>
    );

  return (
    <>
      <PageHeader
        back={back}
        title={asset.name}
        description={
          <span className="inline-meta">
            <StatusBadge status={asset.status} />
            {kindLabel[asset.kind] ?? asset.kind} · Version {asset.latest_version_no}
            {feedback > 0 && ` · ${feedback} ${feedback === 1 ? "comment" : "comments"} from your client`}
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
      <div className="asset-workspace">{workspace}</div>
    </>
  );
}
