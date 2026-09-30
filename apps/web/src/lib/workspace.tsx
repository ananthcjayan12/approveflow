import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ApiError, api } from "./api";
import { setSignedInHint } from "./auth";
export type ClientRow = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  notes: string;
};
export type ProjectRow = {
  id: string;
  client_id: string;
  name: string;
  description: string;
  due_at: string;
  company_name: string;
};
export type AssetRow = {
  id: string;
  project_id: string;
  name: string;
  kind: string;
  caption: string;
  status: string;
  latest_version_no: number;
  version_id: string;
  size_bytes: number;
};
export type CommentRow = {
  id: string;
  asset_id: string;
  asset_version_id: string;
  body: string;
  author_type?: string;
  author_name: string;
  created_at: string;
  kind?: string | null;
  x: number | null;
  y: number | null;
  width?: number | null;
  height?: number | null;
  timestamp_ms: number | null;
  start_ms: number | null;
  end_ms: number | null;
  /** Versioned JSON of the markup drawn with the comment ({"v":1,"shapes":[...]}). */
  shape_json?: string | null;
};
export type Workspace = {
  name: string;
  reply_to_email: string;
  timezone: string;
  brand_color: string;
  storage_used_bytes: number;
  storage_quota_bytes: number;
  plan_key: string;
  emailEnabled: boolean;
  billingEnabled: boolean;
};
export type EventRow = {
  id: string;
  event_type: string;
  actor_name: string;
  created_at: string;
  project_id: string;
};
type Data = {
  workspace: Workspace;
  clients: ClientRow[];
  projects: ProjectRow[];
  assets: AssetRow[];
  events: EventRow[];
  reload: () => Promise<void>;
};
const Context = createContext<Data | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Omit<Data, "reload"> | null>(null);
  const [error, setError] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);
  const location = useLocation();
  const reload = async () => {
    try {
      const [workspace, clients, projects, assets, events] = await Promise.all([
        api<Workspace>("/api/workspace"),
        api<ClientRow[]>("/api/clients"),
        api<ProjectRow[]>("/api/projects"),
        api<AssetRow[]>("/api/assets"),
        api<EventRow[]>("/api/activity"),
      ]);
      setData({ workspace, clients, projects, assets, events });
      setError("");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setSignedInHint(false);
        setUnauthorized(true);
      } else setError(String(e));
    }
  };
  useEffect(() => {
    void reload();
    const refresh = () => void reload();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  if (unauthorized) {
    // Remember where they were, so signing in again lands them back there.
    const here = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${here}&reason=expired`} replace />;
  }
  if (!data)
    return (
      <div className="center-page">
        {error ? (
          <div className="card center-card">
            <h2>We couldn’t load your workspace</h2>
            <p role="alert">{error}</p>
            <button className="button button-primary" onClick={() => void reload()}>
              Try again
            </button>
          </div>
        ) : (
          <div className="loading" role="status">
            <span className="spinner" /> Loading your workspace…
          </div>
        )}
      </div>
    );
  return (
    <Context.Provider value={{ ...data, reload }}>
      {error && (
        <p className="global-error" role="alert">
          Something went wrong refreshing your data. {error}
        </p>
      )}
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const data = useContext(Context);
  if (!data) throw new Error("Workspace unavailable");
  return data;
}
export const mediaUrl = (asset: AssetRow, token?: string) =>
  `/api/media/${asset.version_id}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
