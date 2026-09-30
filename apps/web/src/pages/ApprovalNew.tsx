import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FolderPlus,
  Mail,
  MessageCircle,
  Send,
  Upload,
} from "lucide-react";
import { EmptyState, Field, Notice, PageHeader, StatusBadge, Thumb } from "../components/ui";
import { api, formBody } from "../lib/api";
import { useWorkspace } from "../lib/workspace";

type Sent = { url: string; emailStatus: string; name: string; email: string; count: number };

function ShareScreen({ sent, projectId, projectName }: { sent: Sent; projectId: string; projectName: string }) {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const firstName = sent.name.split(/\s+/).find((w) => w && !w.endsWith(".")) || "there";
  const text = `Hi ${firstName}, the content for ${projectName} is ready for your review. You can approve or leave comments here — no login needed: ${sent.url}`;
  const copy = () =>
    void navigator.clipboard
      .writeText(sent.url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setMessage("Couldn’t copy automatically — select the link and copy it."));
  return (
    <div className="card success-card">
      <span className="success-icon">
        <CheckCircle2 size={34} />
      </span>
      <h2>
        {sent.emailStatus === "sent" ? `Sent to ${sent.name || sent.email}!` : "Your review link is ready"}
      </h2>
      <p>
        {sent.emailStatus === "sent"
          ? `We emailed ${sent.email} a private link to review ${sent.count} ${sent.count === 1 ? "file" : "files"}. You can also share it yourself:`
          : sent.emailStatus === "failed"
            ? "We couldn’t send the email, but the link works. Share it with your client:"
            : `Share this private link with ${sent.name || "your client"}. They can review without an account.`}
      </p>
      <div className="copy-box">
        <input readOnly value={sent.url} aria-label="Review link" onFocus={(e) => e.target.select()} />
        <button className="button button-primary" onClick={copy}>
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <Notice message={message} tone="error" />
      <div className="share-row">
        <a className="button button-secondary" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
          <MessageCircle size={16} /> WhatsApp
        </a>
        <a
          className="button button-secondary"
          href={`mailto:${sent.email}?subject=${encodeURIComponent(`Please review: ${projectName}`)}&body=${encodeURIComponent(text)}`}
        >
          <Mail size={16} /> Email
        </a>
        <a className="button button-secondary" href={sent.url} target="_blank" rel="noreferrer">
          <ExternalLink size={16} /> Preview as client
        </a>
      </div>
      <Link className="link" to={`/app/projects/${projectId}`}>
        Back to project
      </Link>
    </div>
  );
}

export default function ApprovalNew() {
  const { projects, clients, assets, workspace, reload } = useWorkspace();
  const [params] = useSearchParams();
  const [project, setProject] = useState(params.get("project") || projects[0]?.id || "");
  const preset = params.get("assets")?.split(",").filter(Boolean);
  const defaultSelection = (projectId: string) =>
    assets.filter((a) => a.project_id === projectId && a.status === "draft").map((a) => a.id);
  const [selected, setSelected] = useState<string[]>(preset?.length ? preset : defaultSelection(project));
  const [sent, setSent] = useState<Sent | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const current = projects.find((p) => p.id === project);
  const client = clients.find((c) => c.id === current?.client_id);
  const mine = assets.filter((a) => a.project_id === project);
  const chosen = selected.filter((id) => mine.some((a) => a.id === id));
  const toggle = (id: string) =>
    setSelected((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = formBody(e.currentTarget);
    setBusy(true);
    setMessage("");
    try {
      const result = await api<{ reviewUrl: string; emailStatus: string }>("/api/approvals", {
        method: "POST",
        body: JSON.stringify({
          ...data,
          projectId: project,
          assetIds: chosen,
          sendEmail: data.sendEmail === "on",
          reminders: data.reminders === "on",
        }),
      });
      setSent({
        url: result.reviewUrl,
        emailStatus: result.emailStatus,
        name: String(data.reviewerName || ""),
        email: String(data.reviewerEmail || ""),
        count: chosen.length,
      });
      await reload();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <>
        <PageHeader title="Sent for approval" />
        <ShareScreen sent={sent} projectId={project} projectName={current?.name ?? ""} />
      </>
    );

  if (!projects.length)
    return (
      <>
        <PageHeader title="Send for approval" />
        <div className="card">
          <EmptyState
            icon={<FolderPlus size={26} />}
            title="Nothing to send yet"
            body="Create a project and upload some content first."
            action={<Link className="button button-primary" to="/app/projects/new">Create a project</Link>}
          />
        </div>
      </>
    );

  return (
    <>
      <PageHeader
        title="Send for approval"
        description="Your client gets a private link. They can approve or comment — no account needed."
      />
      <form className="steps-form" onSubmit={submit}>
        <section className="card step-card">
          <div className="step-title">
            <span className="step-num">1</span>
            <div>
              <h2>What should they review?</h2>
              <p>Pick a project, then choose the files.</p>
            </div>
          </div>
          <Field label="Project">
            <select
              value={project}
              onChange={(e) => {
                setProject(e.target.value);
                setSelected(defaultSelection(e.target.value));
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.company_name} — {p.name}
                </option>
              ))}
            </select>
          </Field>
          {mine.length ? (
            <>
              <div className="select-head">
                <span>
                  <b>{chosen.length}</b> of {mine.length} selected
                </span>
                <button
                  type="button"
                  className="link"
                  onClick={() => setSelected(chosen.length === mine.length ? [] : mine.map((a) => a.id))}
                >
                  {chosen.length === mine.length ? "Clear selection" : "Select all"}
                </button>
              </div>
              <div className="pick-grid">
                {mine.map((a) => {
                  const on = chosen.includes(a.id);
                  return (
                    <label key={a.id} className={`pick ${on ? "on" : ""}`}>
                      <input type="checkbox" className="visually-hidden" checked={on} onChange={() => toggle(a.id)} />
                      <span className="thumb thumb-card">
                        <Thumb asset={a} />
                        <span className="pick-check">{on && <Check size={14} strokeWidth={3} />}</span>
                      </span>
                      <b title={a.name}>{a.name}</b>
                      <StatusBadge status={a.status} />
                    </label>
                  );
                })}
              </div>
            </>
          ) : (
            <EmptyState
              icon={<Upload size={24} />}
              title="This project has no files yet"
              body="Upload something first, then come back here."
              action={
                <Link className="button button-primary" to={`/app/upload?project=${project}`}>
                  Upload files
                </Link>
              }
            />
          )}
        </section>

        <section className="card step-card">
          <div className="step-title">
            <span className="step-num">2</span>
            <div>
              <h2>Who should approve it?</h2>
              <p>We’ve filled this in from your client details.</p>
            </div>
          </div>
          <div className="field-row">
            <Field label="Name">
              <input key={`name-${project}`} name="reviewerName" required defaultValue={client?.contact_name} />
            </Field>
            <Field label="Email">
              <input key={`email-${project}`} name="reviewerEmail" type="email" required defaultValue={client?.email} />
            </Field>
          </div>
        </section>

        <section className="card step-card">
          <div className="step-title">
            <span className="step-num">3</span>
            <div>
              <h2>Add a note</h2>
              <p>Optional — your client sees this with the link.</p>
            </div>
          </div>
          <Field label="Message" optional>
            <textarea
              name="message"
              rows={3}
              defaultValue="Hi! Here’s the latest content for your review. Please approve or leave comments on anything you’d like changed."
            />
          </Field>
          <Field label="Need a decision by" optional>
            <input name="dueAt" type="date" />
          </Field>
          {workspace.emailEnabled ? (
            <div className="toggles">
              <label className="toggle">
                <input type="checkbox" name="sendEmail" defaultChecked />
                <span className="switch" />
                <span>
                  <b>Email the link to them now</b>
                  <small>Otherwise, you’ll get a link to share yourself.</small>
                </span>
              </label>
              <label className="toggle">
                <input type="checkbox" name="reminders" />
                <span className="switch" />
                <span>
                  <b>Send friendly reminders</b>
                  <small>We’ll nudge them if they haven’t responded.</small>
                </span>
              </label>
            </div>
          ) : (
            <p className="hint-box">You’ll get a private link to share on WhatsApp, email or anywhere you like.</p>
          )}
        </section>

        <div className="sticky-actions">
          <Notice message={message} tone="error" />
          <span className="muted">
            {chosen.length
              ? `${chosen.length} ${chosen.length === 1 ? "file" : "files"} ready to send`
              : "Select at least one file"}
          </span>
          <button className="button button-primary large" disabled={busy || !chosen.length}>
            <Send size={17} /> {busy ? "Sending…" : workspace.emailEnabled ? "Send for approval" : "Create review link"}
          </button>
        </div>
      </form>
    </>
  );
}
