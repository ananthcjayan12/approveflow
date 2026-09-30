import { FormEvent, ReactNode, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { Topbar } from "../components/Topbar";
import { PageHeader } from "../components/PageHeader";
import { MetricCard } from "../components/MetricCard";
import { api, uploadFile } from "../lib/api";
import {
  AssetRow,
  mediaUrl,
  statusLabel,
  useWorkspace,
} from "../lib/workspace";

export function Frame({
  title,
  eyebrow = "WORKSPACE",
  children,
  action,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <>
      <Topbar />
      <div className="page-pad">
        <PageHeader title={title} eyebrow={eyebrow} action={action} />
        {children}
      </div>
    </>
  );
}
export function Feedback({ message }: { message: string }) {
  return message ? (
    <p role="status" className="form-feedback">
      {message}
    </p>
  ) : null;
}
export function Media({
  asset,
  token,
  controls = false,
}: {
  asset: AssetRow;
  token?: string;
  controls?: boolean;
}) {
  const src = mediaUrl(asset, token);
  return asset.kind === "video" ? (
    <video src={src} controls={controls} preload="metadata" />
  ) : asset.kind === "pdf" ? (
    <iframe title={asset.name} src={src} />
  ) : (
    <img src={src} alt={asset.name} />
  );
}
const formBody = (form: HTMLFormElement) =>
  Object.fromEntries(new FormData(form));
export function Dashboard() {
  const { workspace, assets, projects, events } = useWorkspace();
  return (
    <Frame
      title={`Welcome, ${workspace.name}.`}
      eyebrow="LET’S KEEP WORK MOVING"
    >
      <div className="metrics-grid">
        {["waiting", "changes_requested", "approved", "draft"].map((status) => (
          <MetricCard
            key={status}
            value={assets.filter((a) => a.status === status).length}
            label={statusLabel(status)}
          />
        ))}
      </div>
      {!projects.length && (
        <div className="panel">
          <h2>Your first approval starts here.</h2>
          <p>
            Add a client, create a project, upload a creative, then share a
            review link.
          </p>
          <Link className="button button-primary" to="/app/clients/new">
            Add your first client
          </Link>
        </div>
      )}
      <div className="two-col">
        <section className="panel">
          <h2>Recent projects</h2>
          {projects.slice(0, 6).map((p) => (
            <Link
              className="project-row"
              key={p.id}
              to={`/app/projects/${p.id}`}
            >
              <div className="grow">
                <b>{p.name}</b>
                <span>{p.company_name}</span>
              </div>
              <span>
                {assets.filter((a) => a.project_id === p.id).length} assets
              </span>
            </Link>
          ))}
        </section>
        <aside className="panel dark-panel">
          <h2>Recent activity</h2>
          {events.slice(0, 6).map((e) => (
            <p key={e.id}>
              {statusLabel(e.event_type.replaceAll(".", " "))} · {e.actor_name}
              <br />
              <small>{e.created_at}</small>
            </p>
          ))}
          {!events.length && <p>No activity yet.</p>}
        </aside>
      </div>
    </Frame>
  );
}
export function ClientsList() {
  const { clients, projects } = useWorkspace();
  const [query, setQuery] = useState("");
  return (
    <Frame
      title="Clients"
      action={
        <Link className="button button-primary" to="/app/clients/new">
          Add client
        </Link>
      }
    >
      <label>
        Find a client
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clients…"
        />
      </label>
      <div className="client-grid">
        {clients
          .filter((c) =>
            `${c.company_name} ${c.email}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((c) => (
            <Link className="panel" key={c.id} to={`/app/clients/${c.id}`}>
              <h2>{c.company_name}</h2>
              <p>
                {c.contact_name} · {c.email}
              </p>
              <small>
                {projects.filter((p) => p.client_id === c.id).length} projects
              </small>
            </Link>
          ))}
      </div>
      {!clients.length && (
        <p>No clients yet. Add your first client to get started.</p>
      )}
    </Frame>
  );
}
export function ClientForm() {
  const { id } = useParams();
  const { clients, reload } = useWorkspace();
  const client = clients.find((c) => c.id === id);
  const nav = useNavigate();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (id && !client)
    return (
      <Frame title="Client not found">
        <Link to="/app/clients">Back to clients</Link>
      </Frame>
    );
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const body = formBody(e.currentTarget);
    setBusy(true);
    try {
      const result = await api<{ id: string }>(
        id ? `/api/clients/${id}` : "/api/clients",
        { method: id ? "PATCH" : "POST", body: JSON.stringify(body) },
      );
      await reload();
      nav(`/app/clients/${id || result.id}`);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame title={id ? "Edit client" : "New client"}>
      <form className="panel form-panel narrow" onSubmit={submit}>
        <label>
          Company name
          <input
            name="companyName"
            required
            defaultValue={client?.company_name}
          />
        </label>
        <label>
          Contact name
          <input
            name="contactName"
            required
            defaultValue={client?.contact_name}
          />
        </label>
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            defaultValue={client?.email}
          />
        </label>
        <label>
          Notes
          <textarea name="notes" defaultValue={client?.notes} />
        </label>
        <Feedback message={message} />
        <button className="button button-primary" disabled={busy}>
          {busy ? "Saving…" : "Save client"}
        </button>
      </form>
    </Frame>
  );
}
export function ClientDetail() {
  const { id } = useParams();
  const { clients, projects, assets } = useWorkspace();
  const c = clients.find((c) => c.id === id);
  if (!c)
    return (
      <Frame title="Client not found">
        <Link to="/app/clients">Back to clients</Link>
      </Frame>
    );
  const mine = projects.filter((p) => p.client_id === id);
  return (
    <Frame
      title={c.company_name}
      action={
        <Link className="button button-ghost" to={`/app/clients/${id}/edit`}>
          Edit client
        </Link>
      }
    >
      <p>
        {c.contact_name} · {c.email}
      </p>
      <p>{c.notes}</p>
      <section className="panel">
        <div className="panel-head">
          <h2>Projects</h2>
          <Link
            className="button button-primary"
            to={`/app/projects/new?client=${id}`}
          >
            New project
          </Link>
        </div>
        {mine.map((p) => (
          <Link className="project-row" to={`/app/projects/${p.id}`} key={p.id}>
            <b>{p.name}</b>
            <span>
              {assets.filter((a) => a.project_id === p.id).length} assets
            </span>
          </Link>
        ))}
        {!mine.length && <p>No projects yet.</p>}
      </section>
    </Frame>
  );
}
export function ProjectsList() {
  const { projects, assets } = useWorkspace();
  const [query, setQuery] = useState("");
  return (
    <Frame
      title="Projects"
      action={
        <Link className="button button-primary" to="/app/projects/new">
          New project
        </Link>
      }
    >
      <label>
        Find a project
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects…"
        />
      </label>
      <div className="panel">
        {projects
          .filter((p) =>
            `${p.name} ${p.company_name}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((p) => (
            <Link
              className="project-row"
              key={p.id}
              to={`/app/projects/${p.id}`}
            >
              <div className="grow">
                <b>{p.name}</b>
                <span>
                  {p.company_name} · {p.due_at || "No due date"}
                </span>
              </div>
              <span>
                {assets.filter((a) => a.project_id === p.id).length} assets
              </span>
            </Link>
          ))}
        {!projects.length && <p>No projects yet.</p>}
      </div>
    </Frame>
  );
}
export function ProjectForm() {
  const { clients, reload } = useWorkspace();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    try {
      const p = await api<{ id: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify(formBody(e.currentTarget)),
      });
      await reload();
      nav(`/app/projects/${p.id}`);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame title="New project">
      {!clients.length ? (
        <Link className="button button-primary" to="/app/clients/new">
          Add a client first
        </Link>
      ) : (
        <form className="panel form-panel narrow" onSubmit={submit}>
          <label>
            Project name
            <input name="name" required />
          </label>
          <label>
            Client
            <select
              name="clientId"
              defaultValue={params.get("client") || clients[0].id}
            >
              {clients.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Description
            <textarea name="description" />
          </label>
          <label>
            Review due date
            <input name="dueAt" type="date" />
          </label>
          <Feedback message={message} />
          <button disabled={busy} className="button button-primary">
            {busy ? "Saving…" : "Create project"}
          </button>
        </form>
      )}
    </Frame>
  );
}
export function ProjectDetail() {
  const { id } = useParams();
  const { projects, assets } = useWorkspace();
  const [filter, setFilter] = useState("all");
  const p = projects.find((p) => p.id === id);
  if (!p)
    return (
      <Frame title="Project not found">
        <Link to="/app/projects">Back to projects</Link>
      </Frame>
    );
  const mine = assets.filter((a) => a.project_id === id);
  return (
    <Frame
      title={p.name}
      eyebrow={p.company_name}
      action={
        <Link
          className="button button-primary"
          to={`/app/approvals/new?project=${id}`}
        >
          Send for approval
        </Link>
      }
    >
      <p>
        {p.description} {p.due_at && `· Due ${p.due_at}`}
      </p>
      <div className="asset-toolbar">
        <div className="filter-pills">
          {[
            "all",
            "draft",
            "waiting",
            "approved",
            "changes_requested",
            "revised",
          ].map((s) => (
            <button
              key={s}
              className={filter === s ? "active" : ""}
              onClick={() => setFilter(s)}
            >
              {statusLabel(s)}
            </button>
          ))}
        </div>
        <Link
          className="button button-primary"
          to={`/app/upload?project=${id}`}
        >
          Add assets
        </Link>
      </div>
      <div className="asset-grid">
        {mine
          .filter((a) => filter === "all" || a.status === filter)
          .map((a) => (
            <Link className="asset-card" key={a.id} to={`/app/assets/${a.id}`}>
              <div className="asset-media">
                <Media asset={a} />
              </div>
              <div className="asset-card-info">
                <b>{a.name}</b>
                <span>Version {a.latest_version_no}</span>
              </div>
              <p className="trial-status">{statusLabel(a.status)}</p>
            </Link>
          ))}
      </div>
      {!mine.length && (
        <div className="panel">
          <h2>Ready for your first creative.</h2>
          <p>Upload an image, PDF, or video to start collecting feedback.</p>
        </div>
      )}
    </Frame>
  );
}
export function UploadContent() {
  const { projects, assets, reload } = useWorkspace();
  const [params] = useSearchParams();
  const revision = assets.find((a) => a.id === params.get("asset"));
  const [project, setProject] = useState(
    revision?.project_id || params.get("project") || projects[0]?.id || "",
  );
  const [files, setFiles] = useState<File[]>([]);
  const [done, setDone] = useState<number[]>([]);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState("");
  const upload = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      for (const [index, file] of files.entries()) {
        if (done.includes(index)) continue;
        if (
          !/^(image\/(png|jpeg|webp|gif)|video\/(mp4|quicktime|webm)|application\/pdf)$/.test(
            file.type,
          )
        )
          throw new Error(
            `Unsupported file: ${file.name}. Use PNG, JPG, WebP, GIF, MP4, MOV, WebM or PDF.`,
          );
        const result = await uploadFile(file, (p) =>
          setProgress(`${file.name}: ${p}%`),
        );
        await api("/api/assets/finalize-upload", {
          method: "POST",
          body: JSON.stringify({
            projectId: project,
            assetId: revision?.id,
            name: revision?.name || file.name,
            kind: file.type.startsWith("video/")
              ? "video"
              : file.type === "application/pdf"
                ? "pdf"
                : "image",
            r2Key: result.key,
            mimeType: file.type,
            size: file.size,
            caption,
          }),
        });
        setDone((v) => [...v, index]);
      }
      await reload();
      setMessage(
        "Uploaded and saved. Open the project to send these assets for review.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame
      title={revision ? "Upload a new version" : "Upload creative content"}
    >
      {!projects.length ? (
        <Link to="/app/projects/new" className="button button-primary">
          Create a project first
        </Link>
      ) : (
        <form className="panel form-panel" onSubmit={upload}>
          <label>
            Project
            <select
              value={project}
              disabled={busy || !!revision}
              onChange={(e) => setProject(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label
            className="drop-zone interactive"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) {
                setFiles(
                  Array.from(e.dataTransfer.files).slice(
                    0,
                    revision ? 1 : undefined,
                  ),
                );
                setDone([]);
              }
            }}
          >
            <b>Drop files here or browse</b>
            <span>
              Images, PDFs and video. Upload carousel slides as individual
              images.
            </span>
            <input
              type="file"
              multiple={!revision}
              disabled={busy}
              accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf"
              onChange={(e) => {
                setFiles(Array.from(e.target.files || []));
                setDone([]);
              }}
            />
          </label>
          {files.map((f, index) => (
            <p key={`${f.name}-${index}`}>
              {f.name} · {(f.size / 1048576).toFixed(2)} MB{" "}
              {done.includes(index) ? "✓ Saved" : ""}
            </p>
          ))}
          <label>
            Caption
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </label>
          <Feedback message={progress} />
          <Feedback message={message} />
          <div className="form-actions">
            <Link
              className="button button-ghost"
              to={`/app/projects/${project}`}
            >
              Open project
            </Link>
            <button
              className="button button-primary"
              disabled={
                busy ||
                !files.length ||
                files.every((_, index) => done.includes(index))
              }
            >
              {busy ? "Uploading…" : "Upload files"}
            </button>
          </div>
        </form>
      )}
    </Frame>
  );
}
export function ApprovalNew() {
  const { projects, clients, assets, workspace, reload } = useWorkspace();
  const [params] = useSearchParams();
  const [project, setProject] = useState(
    params.get("project") || projects[0]?.id || "",
  );
  const [selected, setSelected] = useState<string[]>([]);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const client = clients.find(
    (c) => c.id === projects.find((p) => p.id === project)?.client_id,
  );
  const mine = assets.filter((a) => a.project_id === project);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = formBody(e.currentTarget);
    setBusy(true);
    try {
      const result = await api<{ reviewUrl: string; emailStatus: string }>(
        "/api/approvals",
        {
          method: "POST",
          body: JSON.stringify({
            ...data,
            projectId: project,
            assetIds: selected,
            sendEmail: data.sendEmail === "on",
            reminders: data.reminders === "on",
          }),
        },
      );
      setUrl(result.reviewUrl);
      setMessage(
        result.emailStatus === "sent"
          ? "Invitation email sent."
          : result.emailStatus === "failed"
            ? "Link created, but email delivery failed. Copy and share the link."
            : "Copy and share this private link with your reviewer.",
      );
      await reload();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame
      title={url ? "Ready for client review." : "Send for client approval"}
    >
      {url ? (
        <div className="panel">
          <Feedback message={message} />
          <label>
            Private review link
            <input readOnly value={url} onFocus={(e) => e.target.select()} />
          </label>
          <div className="form-actions">
            <button
              className="button button-primary"
              onClick={() => {
                void navigator.clipboard
                  .writeText(url)
                  .then(() => setMessage("Link copied."))
                  .catch(() =>
                    setMessage("Select the link above and copy it manually."),
                  );
              }}
            >
              Copy link
            </button>
            <a
              className="button button-ghost"
              href={url}
              target="_blank"
              rel="noreferrer"
            >
              Open client review
            </a>
          </div>
        </div>
      ) : !projects.length ? (
        <Link to="/app/projects/new">Create a project first</Link>
      ) : (
        <form className="approval-layout" onSubmit={submit}>
          <section className="panel form-panel">
            <label>
              Project
              <select
                value={project}
                onChange={(e) => {
                  setProject(e.target.value);
                  setSelected([]);
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.company_name} · {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Reviewer name
              <input
                key={`name-${project}`}
                name="reviewerName"
                required
                defaultValue={client?.contact_name}
              />
            </label>
            <label>
              Reviewer email
              <input
                key={`email-${project}`}
                name="reviewerEmail"
                type="email"
                required
                defaultValue={client?.email}
              />
            </label>
            <label>
              Message
              <textarea
                name="message"
                defaultValue="Please review these creatives and leave your feedback."
              />
            </label>
            <label>
              Review requested by
              <input name="dueAt" type="date" />
            </label>
            {workspace.emailEnabled ? (
              <>
                <label className="check">
                  <input type="checkbox" name="sendEmail" defaultChecked />
                  Email the reviewer now
                </label>
                <label className="check">
                  <input type="checkbox" name="reminders" />
                  Send automatic reminders
                </label>
              </>
            ) : (
              <p>
                Email is not enabled for this workspace. You can share the
                review link directly.
              </p>
            )}
            <Feedback message={message} />
            <button
              className="button button-primary"
              disabled={busy || !selected.length}
            >
              {busy ? "Creating…" : "Create approval request"}
            </button>
          </section>
          <aside className="panel">
            <h2>Assets · {selected.length} selected</h2>
            {mine.map((a) => (
              <label className="select-asset" key={a.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(a.id)}
                  onChange={() =>
                    setSelected((v) =>
                      v.includes(a.id)
                        ? v.filter((x) => x !== a.id)
                        : [...v, a.id],
                    )
                  }
                />
                <div>
                  <b>{a.name}</b>
                  <span>
                    Version {a.latest_version_no} · {statusLabel(a.status)}
                  </span>
                </div>
              </label>
            ))}
            {!mine.length && (
              <Link to={`/app/upload?project=${project}`}>
                Upload assets first
              </Link>
            )}
          </aside>
        </form>
      )}
    </Frame>
  );
}
export function ActivityPage() {
  const { events } = useWorkspace();
  return (
    <Frame title="Activity">
      <div className="panel">
        {events.map((e) => (
          <div className="activity-row" key={e.id}>
            <div className="grow">
              <b>{statusLabel(e.event_type.replaceAll(".", " "))}</b>
              <span>{e.actor_name || "System"}</span>
            </div>
            <time>{e.created_at}</time>
            {e.project_id && (
              <Link to={`/app/projects/${e.project_id}`}>View project</Link>
            )}
          </div>
        ))}
        {!events.length && <p>No activity yet.</p>}
      </div>
    </Frame>
  );
}
export function StoragePage() {
  const { workspace, assets } = useWorkspace();
  const format = (n: number) => `${(n / 1048576).toFixed(1)} MB`;
  return (
    <Frame title="Storage">
      <section className="panel">
        <h2>
          {format(workspace.storage_used_bytes)} of{" "}
          {format(workspace.storage_quota_bytes)}
        </h2>
        <div className="storage-bar">
          <span
            style={{
              width: `${Math.min(100, (workspace.storage_used_bytes / workspace.storage_quota_bytes) * 100)}%`,
            }}
          />
        </div>
        <p>
          Usage includes all uploaded versions. Your files are private and
          available through authorized review links.
        </p>
      </section>
      <div className="metrics-grid">
        {["image", "video", "pdf"].map((kind) => (
          <MetricCard
            key={kind}
            label={`${kind} · current versions`}
            value={format(
              assets
                .filter((a) => a.kind === kind)
                .reduce((s, a) => s + a.size_bytes, 0),
            )}
          />
        ))}
      </div>
    </Frame>
  );
}
export function WorkspaceSettings() {
  const { workspace, reload } = useWorkspace();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/workspace", {
        method: "PATCH",
        body: JSON.stringify(formBody(e.currentTarget)),
      });
      await reload();
      setMessage("Workspace saved.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Frame title="Workspace settings">
      <form className="panel form-panel narrow" onSubmit={submit}>
        <label>
          Workspace name
          <input name="name" required defaultValue={workspace.name} />
        </label>
        <label>
          Reply-to email
          <input
            name="replyToEmail"
            type="email"
            required
            defaultValue={workspace.reply_to_email}
          />
        </label>
        <label>
          Timezone
          <select name="timezone" defaultValue={workspace.timezone}>
            {Array.from(
              new Set([
                workspace.timezone,
                "Asia/Kolkata",
                "UTC",
                "America/New_York",
                "Europe/London",
                "Asia/Dubai",
              ]),
            ).map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </label>
        <label>
          Brand color
          <input
            name="brandColor"
            type="color"
            defaultValue={workspace.brand_color}
          />
        </label>
        <Feedback message={message} />
        <button disabled={busy} className="button button-primary">
          {busy ? "Saving…" : "Save workspace"}
        </button>
      </form>
    </Frame>
  );
}
export function NotificationSettings() {
  const { workspace } = useWorkspace();
  return (
    <Frame title="Notifications">
      <div className="panel">
        <h2>
          {workspace.emailEnabled
            ? "Email delivery is enabled"
            : "Share review links directly"}
        </h2>
        <p>
          {workspace.emailEnabled
            ? "Choose email invitations and automatic reminders when creating each approval request."
            : "Email delivery is not configured for this trial. You can still create and share private review links."}
        </p>
        <Link className="button button-primary" to="/app/approvals/new">
          Create approval request
        </Link>
      </div>
    </Frame>
  );
}
export function BillingSettings() {
  const { workspace } = useWorkspace();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function choose(plan: string) {
    setBusy(true);
    try {
      const result = await api<{ shortUrl: string }>(
        "/api/billing/subscription",
        { method: "POST", body: JSON.stringify({ plan }) },
      );
      if (!result.shortUrl)
        throw new Error("Checkout link unavailable. Please try again.");
      window.location.assign(result.shortUrl);
    } catch (e) {
      setMessage((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Frame title="Billing">
      <p>
        Current plan: {workspace.plan_key}.{" "}
        {workspace.billingEnabled
          ? "Choose a plan to continue to checkout."
          : "Your trial is active. Paid subscriptions are not enabled."}
      </p>
      <Feedback message={message} />
      <div className="plan-grid">
        {[
          ["solo", "₹599", "10 GB"],
          ["freelancer", "₹999", "50 GB"],
          ["agency", "₹1,599", "150 GB"],
        ].map(([plan, price, storage]) => (
          <article className="plan-card" key={plan}>
            <h2>{plan}</h2>
            <h3>{price}/month</h3>
            <p>{storage} storage</p>
            <button
              disabled={busy || !workspace.billingEnabled}
              className="button button-primary"
              onClick={() => void choose(plan)}
            >
              {workspace.billingEnabled
                ? "Choose plan"
                : "Unavailable during trial"}
            </button>
          </article>
        ))}
      </div>
    </Frame>
  );
}
export function Onboarding() {
  return (
    <Frame title="Make this workspace yours." eyebrow="WELCOME TO APPROVEFLOW">
      <div className="panel">
        <p>
          Start with your workspace name, then add a client and a project. You
          can upload your first creative and share a review link in a few
          minutes.
        </p>
        <div className="form-actions">
          <Link className="button button-primary" to="/app/settings/workspace">
            Set up workspace
          </Link>
          <Link className="button button-ghost" to="/app/clients/new">
            Add first client
          </Link>
          <Link to="/app/dashboard">Go to dashboard</Link>
        </div>
      </div>
    </Frame>
  );
}
