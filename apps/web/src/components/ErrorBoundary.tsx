import { Component, ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Brand } from "./Brand";

/**
 * Last line of defence: if a screen crashes (or a code chunk can't be fetched after
 * a new deployment), show a calm recovery screen instead of a blank page.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Unhandled UI error", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="center-page">
        <div className="card center-card">
          <Brand compact />
          <h1 style={{ fontSize: 22 }}>Something went wrong</h1>
          <p className="muted">This page didn’t load properly. Reloading usually fixes it.</p>
          <button className="button button-primary" onClick={() => window.location.reload()}>
            <RefreshCw size={16} /> Reload page
          </button>
        </div>
      </main>
    );
  }
}

/**
 * After a deployment, an open tab may ask for a chunk that no longer exists. Reload once
 * to pick up the new build (the flag stops a reload loop if the network is genuinely down).
 */
export function recoverFromStaleChunks() {
  window.addEventListener("vite:preloadError", () => {
    try {
      if (sessionStorage.getItem("af-chunk-reload")) return;
      sessionStorage.setItem("af-chunk-reload", "1");
    } catch {
      /* storage unavailable: fall through to the error boundary */
      return;
    }
    window.location.reload();
  });
}
