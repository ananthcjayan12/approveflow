import { useEffect, useState } from "react";
import { api } from "./api";

/**
 * The session cookie is HttpOnly, so the page cannot see it. This flag remembers that
 * someone signed in on this device, so returning visitors can be sent straight to the app
 * without the marketing page or login form flashing first. The server stays the authority:
 * the flag is only ever a hint and is cleared the moment the server says 401.
 */
const HINT = "af-signed-in";

export function signedInHint() {
  try {
    return localStorage.getItem(HINT) === "1";
  } catch {
    return false;
  }
}

function writeHint(on: boolean) {
  try {
    if (on) localStorage.setItem(HINT, "1");
    else localStorage.removeItem(HINT);
  } catch {
    /* private mode: the redirect still works, just without the flash-free hint */
  }
}

/** Call when signing in or out (or on a 401): the remembered answer is stale. */
export function setSignedInHint(on: boolean) {
  known = null;
  writeHint(on);
}

// One check is shared by everything on the page that wants to know (the guard and the nav).
let known: Promise<boolean> | null = null;
function checkSession() {
  known ??= api<{ signedIn: boolean }>("/api/auth/session").then(
    (r) => r.signedIn,
    (error) => {
      known = null; // a failed check (offline?) proves nothing; ask again next time
      throw error;
    },
  );
  return known;
}

/** Only ever follow links back into the app itself, never to another site. */
export function safeNext(value: string | null | undefined) {
  if (!value || !/^\/(app|onboarding)(\/|\?|$)/.test(value) || value.startsWith("//") || value.includes("\\")) return null;
  return value;
}

export type SessionStatus = "checking" | "signed-in" | "signed-out";

/** Asks the server whether this browser has a valid session. */
export function useSession(): SessionStatus {
  const [status, setStatus] = useState<SessionStatus>("checking");
  useEffect(() => {
    let live = true;
    checkSession()
      .then((signedIn) => {
        if (!live) return;
        writeHint(signedIn);
        setStatus(signedIn ? "signed-in" : "signed-out");
      })
      .catch(() => {
        // Could not reach the server: show the public page rather than guess, and keep the hint.
        if (live) setStatus("signed-out");
      });
    return () => {
      live = false;
    };
  }, []);
  return status;
}
