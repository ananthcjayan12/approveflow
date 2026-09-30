import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Brand } from "../components/Brand";
import { api } from "../lib/api";
function Auth({ signup = false }: { signup?: boolean }) {
  const nav = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <div className="auth-brand-panel">
        <Brand />
        <div className="auth-quote">
          <div className="eyebrow warm">
            CREATIVE WORK FLOWS FASTER TOGETHER
          </div>
          <h2>
            Less chasing.
            <br />
            More creating.
          </h2>
          <p>One place for your projects, client feedback, and approvals.</p>
        </div>
      </div>
      <div className="auth-card-wrap">
        <form className="auth-card" onSubmit={submit}>
          <Brand compact />
          <h1>{signup ? "Create your account" : "Welcome back"}</h1>
          <p>
            {signup
              ? "Start your trial workspace. No payment required."
              : "Sign in to your workspace."}
          </p>
          {signup && (
            <label>
              Full name
              <input name="name" required maxLength={100} autoComplete="name" />
            </label>
          )}
          <label>
            Email
            <input name="email" required type="email" autoComplete="email" />
          </label>
          <label>
            Password
            <input
              name="password"
              required
              minLength={8}
              maxLength={200}
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
            />
          </label>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <button disabled={busy} className="button button-primary full">
            {busy ? "Please wait…" : signup ? "Create account" : "Log in"}
          </button>
          <small>
            {signup ? "Already have an account?" : "New here?"}{" "}
            <Link to={signup ? "/login" : "/signup"}>
              {signup ? "Log in" : "Create an account"}
            </Link>
          </small>
        </form>
      </div>
    </div>
  );
}
export const Signup = () => <Auth signup />;
export const Login = () => <Auth />;
export const Verify = () => <Navigate to="/onboarding" replace />;
