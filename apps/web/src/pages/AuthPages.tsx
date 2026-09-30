import { FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Check, Eye, EyeOff } from "lucide-react";
import { MarkupArt } from "../components/marketing/Mock";
import { ThemeToggle } from "../components/ThemeToggle";
import { Brand } from "../components/Brand";
import { Field, Notice } from "../components/ui";
import { api } from "../lib/api";
import { safeNext, setSignedInHint } from "../lib/auth";

function Auth({ signup = false }: { signup?: boolean }) {
  const nav = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const expired = !signup && params.get("reason") === "expired";
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      await api(`/api/auth/${signup ? "signup" : "login"}`, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form)),
      });
      setSignedInHint(true);
      // Back to where they were heading (a deep link, or a page that asked them to sign in again).
      nav(signup ? "/onboarding" : (next ?? "/app/dashboard"), { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth">
      <main className="auth-main">
        <div className="auth-top">
          <Link to="/" aria-label="ApproveFlow home">
            <Brand />
          </Link>
          <ThemeToggle />
        </div>
        <form className="auth-form form" onSubmit={submit}>
          <h1>{signup ? "Create your free account" : "Welcome back"}</h1>
          <p className="muted">
            {signup ? "Start your free trial. No credit card needed." : "Log in to see your approvals."}
          </p>
          {signup && (
            <Field label="Your name">
              <input name="name" required maxLength={100} autoComplete="name" autoFocus />
            </Field>
          )}
          <Field label="Email">
            <input name="email" required type="email" autoComplete="email" autoFocus={!signup} />
          </Field>
          <Field label="Password" hint={signup ? "At least 8 characters." : undefined}>
            <span className="password">
              <input
                name="password"
                required
                minLength={8}
                maxLength={200}
                type={show ? "text" : "password"}
                autoComplete={signup ? "new-password" : "current-password"}
              />
              <button
                type="button"
                className="icon-button ghost"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </Field>
          <Notice message={expired ? "Your session ended. Log in again to pick up where you left off." : ""} tone="info" />
          <Notice message={error} tone="error" />
          <button disabled={busy} className="button button-primary large full">
            {busy ? "Please wait…" : signup ? "Create account" : "Log in"}
          </button>
          <p className="muted center small">
            {signup ? "Already have an account?" : "New to ApproveFlow?"}{" "}
            <Link className="link" to={{ pathname: signup ? "/login" : "/signup", search: next ? `?next=${encodeURIComponent(next)}` : "" }}>
              {signup ? "Log in" : "Create a free account"}
            </Link>
          </p>
        </form>
      </main>
      <aside className="auth-aside">
        <div>
          <h2>Client approvals, finally simple.</h2>
          <ul className="checks light">
            <li><Check size={18} /> Send posts, reels and designs in one link</li>
            <li><Check size={18} /> Clients approve without creating an account</li>
            <li><Check size={18} /> Draw, highlight and comment right on the work</li>
            <li><Check size={18} /> Know exactly what’s approved — and what’s not</li>
          </ul>
          <div className="auth-art" aria-hidden>
            <MarkupArt />
            <span className="auth-chip">
              <Check size={16} strokeWidth={3} /> Priya approved 4 posts
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
}
export const Signup = () => <Auth signup />;
export const Login = () => <Auth />;
export const Verify = () => <Navigate to="/onboarding" replace />;
