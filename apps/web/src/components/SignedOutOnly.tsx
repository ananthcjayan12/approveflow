import { ReactNode } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { safeNext, signedInHint, useSession } from "../lib/auth";

export function PageLoading() {
  return (
    <div className="center-page">
      <div className="loading" role="status" aria-label="Loading">
        <span className="spinner" />
      </div>
    </div>
  );
}

/**
 * Pages meant for visitors (the site, login, sign-up). Someone who is already signed in is
 * sent to their dashboard instead — typing the address or letting the browser autocomplete
 * to /login must never ask a signed-in person to log in again.
 */
export function SignedOutOnly({ children, allowSiteParam = false }: { children: ReactNode; allowSiteParam?: boolean }) {
  const status = useSession();
  const [params] = useSearchParams();
  // "/?site" lets a signed-in owner still look at the marketing page.
  if (allowSiteParam && params.has("site")) return <>{children}</>;
  if (status === "signed-in") return <Navigate to={safeNext(params.get("next")) ?? "/app/dashboard"} replace />;
  // A returning visitor waits a beat for the answer rather than seeing a page flash by.
  if (status === "checking" && signedInHint()) return <PageLoading />;
  return <>{children}</>;
}
