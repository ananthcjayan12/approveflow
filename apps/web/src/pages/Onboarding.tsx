import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { Brand } from "../components/Brand";
import { Field, Notice } from "../components/ui";
import { api, formBody } from "../lib/api";
import { useWorkspace } from "../lib/workspace";

export default function Onboarding() {
  const { workspace, reload } = useWorkspace();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<unknown>, next: () => void) => {
    setBusy(true);
    setMessage("");
    try {
      await work();
      await reload();
      next();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const saveWorkspace = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { name } = formBody(e.currentTarget);
    void run(
      () =>
        api("/api/workspace", {
          method: "PATCH",
          body: JSON.stringify({
            name,
            replyToEmail: workspace.reply_to_email,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || workspace.timezone,
            brandColor: workspace.brand_color,
          }),
        }),
      () => setStep(1),
    );
  };
  const saveClient = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const body = formBody(e.currentTarget);
    void run(
      () => api("/api/clients", { method: "POST", body: JSON.stringify(body) }),
      () => nav("/app/dashboard"),
    );
  };
  const suggested = workspace.name.endsWith(" Workspace") ? "" : workspace.name;
  return (
    <div className="onboarding">
      <Brand />
      <div className="onboarding-card card">
        <ol className="dots" aria-label={`Step ${step + 1} of 2`}>
          {[0, 1].map((i) => (
            <li key={i} className={i < step ? "done" : i === step ? "current" : ""}>
              {i < step ? <Check size={12} strokeWidth={3} /> : i + 1}
            </li>
          ))}
        </ol>
        {step === 0 ? (
          <form className="form" onSubmit={saveWorkspace}>
            <h1>Welcome! What’s your business called?</h1>
            <p className="muted">Your clients will see this name when they review your work.</p>
            <Field label="Business or studio name" hint="You can change this later in Settings.">
              <input name="name" required autoFocus defaultValue={suggested} placeholder="e.g. Pixel & Post Studio" />
            </Field>
            <Notice message={message} tone="error" />
            <button className="button button-primary large full" disabled={busy}>
              {busy ? "Saving…" : "Continue"} <ArrowRight size={17} />
            </button>
          </form>
        ) : (
          <form className="form" onSubmit={saveClient}>
            <h1>Who’s your first client?</h1>
            <p className="muted">Add one client now — it takes 20 seconds. You can add more later.</p>
            <Field label="Company or brand name">
              <input name="companyName" required autoFocus placeholder="e.g. SmileCraft Dental" />
            </Field>
            <div className="field-row">
              <Field label="Contact person">
                <input name="contactName" required placeholder="Full name" />
              </Field>
              <Field label="Their email">
                <input name="email" type="email" required placeholder="name@company.com" />
              </Field>
            </div>
            <Notice message={message} tone="error" />
            <button className="button button-primary large full" disabled={busy}>
              {busy ? "Saving…" : "Add client & finish"} <ArrowRight size={17} />
            </button>
            <button type="button" className="button button-ghost full" onClick={() => nav("/app/dashboard")}>
              Skip for now
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
