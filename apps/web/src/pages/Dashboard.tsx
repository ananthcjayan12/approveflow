import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  PartyPopper,
  Send,
  Upload,
} from "lucide-react";
import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ActivityFeed } from "../components/ActivityFeed";
import { EmptyState, PageHeader, ProgressBar, StatusBadge, Thumb } from "../components/ui";
import { isWaiting } from "../lib/format";
import { AssetRow, useWorkspace } from "../lib/workspace";

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function SetupChecklist() {
  const { clients, projects, assets, events } = useWorkspace();
  const firstProject = projects[0]?.id;
  const steps = [
    {
      title: "Add a client",
      body: "The person or brand who approves your work.",
      done: clients.length > 0,
      to: "/app/clients/new",
      cta: "Add client",
    },
    {
      title: "Create a project",
      body: "A folder for a campaign or month of content.",
      done: projects.length > 0,
      to: "/app/projects/new",
      cta: "Create project",
    },
    {
      title: "Upload your content",
      body: "Images, videos or PDFs — drag and drop.",
      done: assets.length > 0,
      to: firstProject ? `/app/upload?project=${firstProject}` : "/app/upload",
      cta: "Upload files",
    },
    {
      title: "Send it for approval",
      body: "Share one private link. No client login needed.",
      done:
        assets.some((a) => a.status !== "draft") ||
        events.some((e) => e.event_type === "approval.sent"),
      to: "/app/approvals/new",
      cta: "Send for approval",
    },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.findIndex((s) => !s.done);
  return (
    <section className="card setup-card">
      <div className="setup-head">
        <div>
          <h2>Get your first approval in 4 easy steps</h2>
          <p>
            {done} of {steps.length} done — most people finish in under 5 minutes.
          </p>
        </div>
        <ProgressBar value={(done / steps.length) * 100} label="Setup progress" />
      </div>
      <ol className="setup-steps">
        {steps.map((step, i) => (
          <li
            key={step.title}
            className={step.done ? "done" : i === next ? "current" : ""}
          >
            <span className="step-dot">{step.done ? <Check size={15} strokeWidth={3} /> : i + 1}</span>
            <div>
              <b>{step.title}</b>
              <span>{step.body}</span>
            </div>
            {i === next && (
              <Link className="button button-primary small" to={step.to}>
                {step.cta} <ArrowRight size={15} />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Stat({
  icon,
  tone,
  value,
  label,
}: {
  icon: ReactNode;
  tone: string;
  value: number;
  label: string;
}) {
  return (
    <div className="stat">
      <span className={`stat-icon tone-${tone}`}>{icon}</span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function AssetList({
  title,
  hint,
  items,
  action,
}: {
  title: string;
  hint: string;
  items: AssetRow[];
  action: (asset: AssetRow) => ReactNode;
}) {
  const { projects } = useWorkspace();
  if (!items.length) return null;
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
        <span className="count">{items.length}</span>
      </div>
      <ul className="asset-list">
        {items.slice(0, 5).map((a) => {
          const project = projects.find((p) => p.id === a.project_id);
          return (
            <li key={a.id}>
              <Link to={`/app/assets/${a.id}`} className="asset-list-main">
                <span className="thumb thumb-sm">
                  <Thumb asset={a} />
                </span>
                <span className="asset-list-text">
                  <b>{a.name}</b>
                  <small>
                    {project?.company_name} · {project?.name}
                  </small>
                </span>
              </Link>
              <StatusBadge status={a.status} />
              {action(a)}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function Dashboard() {
  const { workspace, assets, events } = useWorkspace();
  const changes = assets.filter((a) => a.status === "changes_requested");
  const waiting = assets.filter((a) => isWaiting(a.status));
  const drafts = assets.filter((a) => a.status === "draft");
  const approved = assets.filter((a) => a.status === "approved");
  const hasWork = changes.length + waiting.length + drafts.length > 0;
  return (
    <>
      <PageHeader
        title={`${greeting()}, ${workspace.name}`}
        description="Here’s where your approvals stand today."
      />
      <SetupChecklist />
      {assets.length > 0 && (
        <div className="stats">
          <Stat
            icon={<AlertCircle size={20} />}
            tone="red"
            value={changes.length}
            label="Need your changes"
          />
          <Stat
            icon={<Clock3 size={20} />}
            tone="amber"
            value={waiting.length}
            label="Waiting for client"
          />
          <Stat
            icon={<CheckCircle2 size={20} />}
            tone="green"
            value={approved.length}
            label="Approved"
          />
        </div>
      )}
      <div className="split">
        <div className="stack">
          <AssetList
            title="Needs your attention"
            hint="Your client asked for changes. Upload a new version when ready."
            items={changes}
            action={(a) => (
              <Link className="button button-primary small" to={`/app/upload?asset=${a.id}`}>
                <Upload size={14} /> New version
              </Link>
            )}
          />
          <AssetList
            title="Ready to send"
            hint="Uploaded, but your client hasn’t seen these yet."
            items={drafts}
            action={(a) => (
              <Link
                className="button button-secondary small"
                to={`/app/approvals/new?project=${a.project_id}&assets=${a.id}`}
              >
                <Send size={14} /> Send
              </Link>
            )}
          />
          <AssetList
            title="Waiting for client"
            hint="Sent and waiting for a decision. Nothing to do yet."
            items={waiting}
            action={() => null}
          />
          {!hasWork && assets.length > 0 && (
            <div className="card">
              <EmptyState
                icon={<PartyPopper size={26} />}
                title="You’re all caught up"
                body="Everything you’ve sent has been approved. Upload new content whenever you’re ready."
                action={
                  <Link className="button button-primary" to="/app/upload">
                    <Upload size={16} /> Upload content
                  </Link>
                }
              />
            </div>
          )}
        </div>
        <section className="card">
          <div className="card-head">
            <h2>Recent activity</h2>
            {events.length > 0 && (
              <Link className="link" to="/app/activity">
                See all
              </Link>
            )}
          </div>
          {events.length ? (
            <ActivityFeed events={events} limit={7} />
          ) : (
            <p className="muted">
              Updates from you and your clients will show up here.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
