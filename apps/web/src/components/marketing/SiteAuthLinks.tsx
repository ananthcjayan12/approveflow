import { Link } from "react-router-dom";
import { signedInHint, useSession } from "../../lib/auth";

/** Whether to present the site as a signed-in visitor (uses the hint until the server answers). */
export function useSignedInUi() {
  const status = useSession();
  return status === "signed-in" || (status === "checking" && signedInHint());
}

export function SiteAuthLinks({ signedIn }: { signedIn: boolean }) {
  return signedIn ? (
    <Link className="button button-primary" to="/app/dashboard">
      Open dashboard
    </Link>
  ) : (
    <>
      <Link className="link-quiet hide-mobile" to="/login">
        Log in
      </Link>
      <Link className="button button-primary" to="/signup">
        Start free
      </Link>
    </>
  );
}
