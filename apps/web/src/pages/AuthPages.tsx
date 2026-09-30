import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Check, Eye, EyeOff } from "lucide-react";
import { Brand } from "../components/Brand";
import { Field, Notice } from "../components/ui";
import { api } from "../lib/api";

function Auth({ signup = false }: { signup?: boolean }) {
  const nav = useNavigate();
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
      nav(signup ? "/onboarding" : "/app/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth">
      <div className="auth-main">
        <Link to="/">
          <Brand />
        </Link>
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
          <Notice message={error} tone="error" />
          <button disabled={busy} className="button button-primary large full">
            {busy ? "Please wait…" : signup ? "Create account" : "Log in"}
          </button>
          <p className="muted center small">
            {signup ? "Already have an account?" : "New to ApproveFlow?"}{" "}
            <Link className="link" to={signup ? "/login" : "/signup"}>
              {signup ? "Log in" : "Create a free account"}
            </Link>
          </p>
        </form>
      </div>
      <aside className="auth-aside">
        <div>
          <h2>Client approvals, finally simple.</h2>
          <ul className="checks light">
            <li><Check size={18} /> Send posts, reels and designs in one link</li>
            <li><Check size={18} /> Clients approve without creating an account</li>
            <li><Check size={18} /> Comments pinned right where changes are needed</li>
            <li><Check size={18} /> Know exactly what’s approved — and what’s not</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
export const Signup = () => <Auth signup />;
export const Login = () => <Auth />;
export const Verify = () => <Navigate to="/onboarding" replace />;
