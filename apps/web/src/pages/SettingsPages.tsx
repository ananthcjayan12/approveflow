import { FormEvent, ReactNode, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Bell, Mail, Send } from "lucide-react";
import { PlanCards } from "../components/PlanCards";
import { Field, Notice, PageHeader, ProgressBar } from "../components/ui";
import { api, formBody } from "../lib/api";
import { formatBytes } from "../lib/format";
import { useWorkspace } from "../lib/workspace";

const tabs = [
  ["/app/settings/workspace", "General"],
  ["/app/settings/notifications", "Notifications"],
  ["/app/settings/billing", "Plan & billing"],
  ["/app/storage", "Storage"],
] as const;

export function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title="Settings" />
      <nav className="tabs settings-tabs" aria-label="Settings">
        {tabs.map(([to, label]) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "tab active" : "tab")}>
            {label}
          </NavLink>
        ))}
      </nav>
      {children}
    </>
  );
}

export const timezones = () =>
  Array.from(
    new Set([
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      "Asia/Kolkata",
      "UTC",
      "Europe/London",
      "Asia/Dubai",
      "Asia/Singapore",
      "America/New_York",
      "America/Los_Angeles",
      "Australia/Sydney",
    ]),
  );

export function WorkspaceSettings() {
  const { workspace, reload } = useWorkspace();
  const [message, setMessage] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/workspace", { method: "PATCH", body: JSON.stringify(formBody(e.currentTarget)) });
      await reload();
      setMessage({ text: "Saved.", ok: true });
    } catch (err) {
      setMessage({ text: (err as Error).message, ok: false });
    } finally {
      setBusy(false);
    }
  };
  return (
    <SettingsLayout>
      <form className="card form narrow" onSubmit={submit}>
        <Field label="Business name" hint="Shown to your clients on review pages and emails.">
          <input name="name" required defaultValue={workspace.name} />
        </Field>
        <Field label="Reply-to email" hint="When clients reply to our emails, it goes here.">
          <input name="replyToEmail" type="email" required defaultValue={workspace.reply_to_email} />
        </Field>
        <Field label="Time zone" hint="Used for deadlines and reminders.">
          <select name="timezone" defaultValue={workspace.timezone}>
            {Array.from(new Set([workspace.timezone, ...timezones()])).map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </Field>
        <Field label="Brand colour" hint="Used for your workspace badge.">
          <input name="brandColor" type="color" className="color-input" defaultValue={workspace.brand_color} />
        </Field>
        <Notice message={message.text} tone={message.ok ? "success" : "error"} />
        <div className="form-actions">
          <button disabled={busy} className="button button-primary">
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </SettingsLayout>
  );
}

export function NotificationSettings() {
  const { workspace } = useWorkspace();
  return (
    <SettingsLayout>
      <div className="card narrow feature-card">
        <span className={`stat-icon ${workspace.emailEnabled ? "tone-green" : "tone-gray"}`}>
          {workspace.emailEnabled ? <Mail size={20} /> : <Bell size={20} />}
        </span>
        <div>
          <h2>{workspace.emailEnabled ? "Email is on" : "Share links yourself"}</h2>
          <p>
            {workspace.emailEnabled
              ? "Each time you send for approval, you can choose to email your client and send automatic reminders."
              : "Email delivery isn’t set up for this workspace yet. You can still send review links over WhatsApp, email or any chat app."}
          </p>
          <Link className="button button-primary" to="/app/approvals/new">
            <Send size={16} /> Send for approval
          </Link>
        </div>
      </div>
    </SettingsLayout>
  );
}

export function BillingSettings() {
  const { workspace } = useWorkspace();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function choose(plan: string) {
    setBusy(true);
    try {
      const result = await api<{ shortUrl: string }>("/api/billing/subscription", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      if (!result.shortUrl) throw new Error("Checkout link unavailable. Please try again.");
      window.location.assign(result.shortUrl);
    } catch (err) {
      setMessage((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <SettingsLayout>
      <div className="card summary-card">
        <div>
          <b>You’re on the <span className="capitalize">{workspace.plan_key}</span> plan</b>
          <span>
            {workspace.billingEnabled
              ? "Upgrade any time — you’ll be taken to a secure checkout."
              : "Your free trial is active. Paid plans aren’t available yet."}
          </span>
        </div>
      </div>
      <Notice message={message} tone="error" />
      <PlanCards
        headingLevel={2}
        action={(plan) =>
          workspace.plan_key === plan.key ? (
            <button className="button button-secondary full" disabled>
              Current plan
            </button>
          ) : (
            <button
              disabled={busy || !workspace.billingEnabled}
              className={`button full ${plan.popular ? "button-primary" : "button-secondary"}`}
              onClick={() => void choose(plan.key)}
            >
              {workspace.billingEnabled ? `Choose ${plan.name}` : "Available soon"}
            </button>
          )
        }
      />
    </SettingsLayout>
  );
}

export function StoragePage() {
  const { workspace, assets } = useWorkspace();
  const pct = (workspace.storage_used_bytes / Math.max(1, workspace.storage_quota_bytes)) * 100;
  const byKind = [
    ["image", "Images", "var(--brand)"],
    ["video", "Videos", "var(--amber-dot)"],
    ["pdf", "PDFs", "var(--green-dot)"],
  ].map(([kind, label, dot]) => ({
    label,
    dot,
    bytes: assets.filter((a) => a.kind === kind).reduce((s, a) => s + a.size_bytes, 0),
    count: assets.filter((a) => a.kind === kind).length,
  }));
  return (
    <SettingsLayout>
      <section className="card narrow">
        <h2 className="storage-figure">
          {formatBytes(workspace.storage_used_bytes)} <span>of {formatBytes(workspace.storage_quota_bytes)} used</span>
        </h2>
        <ProgressBar value={pct} label="Storage used" />
        <p className="muted small">
          Includes every version you’ve uploaded. Files are private and only visible through your review links.
        </p>
        <ul className="storage-list">
          {byKind.map((k) => (
            <li key={k.label}>
              <span>
                <i style={{ background: k.dot }} />
                {k.label} <small>({k.count})</small>
              </span>
              <b>{formatBytes(k.bytes)}</b>
            </li>
          ))}
        </ul>
        {pct > 80 && (
          <Link className="button button-primary" to="/app/settings/billing">
            Get more storage
          </Link>
        )}
      </section>
    </SettingsLayout>
  );
}
