import { FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Mail, Plus, Search, Users } from "lucide-react";
import { Avatar, EmptyState, Field, Notice, PageHeader } from "../components/ui";
import { api, formBody } from "../lib/api";
import { useWorkspace } from "../lib/workspace";

export function ClientsList() {
  const { clients, projects } = useWorkspace();
  const [query, setQuery] = useState("");
  const shown = clients.filter((c) =>
    `${c.company_name} ${c.contact_name} ${c.email}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="Clients"
        description="The people and brands who approve your work."
        action={
          clients.length > 0 && (
            <Link className="button button-primary" to="/app/clients/new">
              <Plus size={17} /> Add client
            </Link>
          )
        }
      />
      {clients.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users size={26} />}
            title="Add your first client"
            body="Save who you work with once — we’ll fill in their details every time you send something for approval."
            action={
              <Link className="button button-primary" to="/app/clients/new">
                <Plus size={17} /> Add client
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {clients.length > 5 && (
            <div className="search inline-search">
              <Search size={17} />
              <input
                type="search"
                aria-label="Filter clients"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter clients…"
              />
            </div>
          )}
          <div className="grid-cards">
            {shown.map((c) => {
              const count = projects.filter((p) => p.client_id === c.id).length;
              return (
                <Link className="card card-link client-card" key={c.id} to={`/app/clients/${c.id}`}>
                  <Avatar name={c.company_name} size="lg" />
                  <div>
                    <h3>{c.company_name}</h3>
                    <p>{c.contact_name}</p>
                  </div>
                  <div className="client-card-foot">
                    <span>
                      <Mail size={14} /> {c.email}
                    </span>
                    <span>
                      {count} {count === 1 ? "project" : "projects"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
          {!shown.length && <p className="muted">No clients match “{query}”.</p>}
        </>
      )}
    </>
  );
}

export function ClientForm() {
  const { id } = useParams();
  const { clients, reload } = useWorkspace();
  const client = clients.find((c) => c.id === id);
  const nav = useNavigate();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (id && !client)
    return (
      <EmptyState
        icon={<Users size={26} />}
        title="Client not found"
        body="It may have been removed."
        action={<Link className="button button-secondary" to="/app/clients">Back to clients</Link>}
      />
    );
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const body = formBody(e.currentTarget);
    setBusy(true);
    try {
      const result = await api<{ id: string }>(id ? `/api/clients/${id}` : "/api/clients", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      await reload();
      nav(`/app/clients/${id || result.id}`);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        title={id ? "Edit client" : "Add a client"}
        description={id ? undefined : "Just the basics. You can change these any time."}
        back={id ? { to: `/app/clients/${id}`, label: client!.company_name } : { to: "/app/clients", label: "Clients" }}
      />
      <form className="card form narrow" onSubmit={submit}>
        <Field label="Company or brand name" hint="For example: SmileCraft Dental">
          <input name="companyName" required autoFocus defaultValue={client?.company_name} />
        </Field>
        <Field label="Who approves your work?" hint="Your main contact at this company.">
          <input name="contactName" required defaultValue={client?.contact_name} placeholder="Full name" />
        </Field>
        <Field label="Their email" hint="We’ll pre-fill this when you send review links.">
          <input name="email" type="email" required defaultValue={client?.email} placeholder="name@company.com" />
        </Field>
        <Field label="Notes" optional hint="Brand guidelines, preferences — anything you want to remember.">
          <textarea name="notes" rows={3} defaultValue={client?.notes} />
        </Field>
        <Notice message={message} tone="error" />
        <div className="form-actions">
          <Link className="button button-ghost" to={id ? `/app/clients/${id}` : "/app/clients"}>
            Cancel
          </Link>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Saving…" : id ? "Save changes" : "Add client"}
          </button>
        </div>
      </form>
    </>
  );
}
