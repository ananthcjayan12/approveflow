import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FolderOpen, Plus, Search, UserPlus } from "lucide-react";
import { ProjectRow } from "../components/ProjectRow";
import { EmptyState, Field, Notice, PageHeader } from "../components/ui";
import { api, formBody } from "../lib/api";
import { useWorkspace } from "../lib/workspace";

export function ProjectsList() {
  const { projects, clients } = useWorkspace();
  const [query, setQuery] = useState("");
  const shown = projects.filter((p) =>
    `${p.name} ${p.company_name}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="Projects"
        description="Each project holds the content for one campaign, month or launch."
        action={
          projects.length > 0 && (
            <Link className="button button-primary" to="/app/projects/new">
              <Plus size={17} /> New project
            </Link>
          )
        }
      />
      {projects.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FolderOpen size={26} />}
            title="Create your first project"
            body={
              clients.length
                ? "Group your content — like “October posts” or “Diwali campaign” — and send it for approval together."
                : "First add a client, then create a project for their content."
            }
            action={
              clients.length ? (
                <Link className="button button-primary" to="/app/projects/new">
                  <Plus size={17} /> New project
                </Link>
              ) : (
                <Link className="button button-primary" to="/app/clients/new">
                  <UserPlus size={17} /> Add a client first
                </Link>
              )
            }
          />
        </div>
      ) : (
        <>
          {projects.length > 5 && (
            <div className="search inline-search">
              <Search size={17} />
              <input
                type="search"
                aria-label="Filter projects"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter projects…"
              />
            </div>
          )}
          <div className="card list">
            {shown.map((p) => (
              <ProjectRow key={p.id} project={p} />
            ))}
            {!shown.length && <p className="muted pad">No projects match “{query}”.</p>}
          </div>
        </>
      )}
    </>
  );
}

export function ProjectForm() {
  const { clients, reload } = useWorkspace();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    try {
      const p = await api<{ id: string }>("/api/projects", {
        method: "POST",
        body: JSON.stringify(formBody(e.currentTarget)),
      });
      await reload();
      nav(`/app/projects/${p.id}`);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const preset = params.get("client");
  return (
    <>
      <PageHeader
        title="New project"
        description="Give it a name your client will recognise."
        back={preset ? { to: `/app/clients/${preset}`, label: "Client" } : { to: "/app/projects", label: "Projects" }}
      />
      {!clients.length ? (
        <div className="card">
          <EmptyState
            icon={<UserPlus size={26} />}
            title="Add a client first"
            body="Every project belongs to a client, so we know who to send it to."
            action={
              <Link className="button button-primary" to="/app/clients/new">
                Add a client
              </Link>
            }
          />
        </div>
      ) : (
        <form className="card form narrow" onSubmit={submit}>
          <Field label="Project name" hint="For example: October posts, Diwali campaign">
            <input name="name" required autoFocus />
          </Field>
          <Field label="Which client is this for?">
            <select name="clientId" defaultValue={preset || clients[0].id}>
              {clients.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </Field>
          <Link className="link small" to="/app/clients/new">
            <Plus size={14} /> Add a new client instead
          </Link>
          <Field label="Approval deadline" optional hint="When do you need the client’s decision?">
            <input name="dueAt" type="date" />
          </Field>
          <Field label="Description" optional>
            <textarea name="description" rows={3} placeholder="What’s this project about?" />
          </Field>
          <Notice message={message} tone="error" />
          <div className="form-actions">
            <Link className="button button-ghost" to="/app/projects">
              Cancel
            </Link>
            <button disabled={busy} className="button button-primary">
              {busy ? "Creating…" : "Create project"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
