import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Navigate } from "react-router-dom";
import { api } from "./api";
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
  author_name: string;
  created_at: string;
  x: number | null;
  y: number | null;
  timestamp_ms: number | null;
  start_ms: number | null;
  end_ms: number | null;
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
      if (e instanceof Error && e.message === "Authentication required")
        setUnauthorized(true);
      else setError(String(e));
    }
  };
  useEffect(() => {
    void reload();
    const refresh = () => void reload();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  useEffect(() => {
    if (!data) return;
    document.documentElement.style.setProperty(
      "--yellow",
      data.workspace.brand_color,
    );
    return () => {
      document.documentElement.style.removeProperty("--yellow");
    };
  }, [data?.workspace.brand_color]);
  if (unauthorized) return <Navigate to="/login" replace />;
  if (!data)
    return (
      <div className="center-page">
        <div className="panel">
          {error ? (
            <>
              <p role="alert">{error}</p>
              <button onClick={() => void reload()}>Retry</button>
            </>
          ) : (
            <p>Loading your workspace…</p>
          )}
        </div>
      </div>
    );
  return (
    <Context.Provider value={{ ...data, reload }}>
      {error && (
        <p className="error-message" role="alert">
          {error}
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
export const statusLabel = (status: string) => status.replaceAll("_", " ");
