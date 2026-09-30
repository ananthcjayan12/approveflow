import { FolderPlus, Mail, Pencil, Plus, User, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { ProjectRow } from "../components/ProjectRow";
import { Avatar, EmptyState, PageHeader } from "../components/ui";
import { useWorkspace } from "../lib/workspace";

export default function ClientDetail() {
  const { id } = useParams();
  const { clients, projects } = useWorkspace();
  const client = clients.find((c) => c.id === id);
  if (!client)
    return (
      <EmptyState
        icon={<Users size={26} />}
        title="Client not found"
        body="It may have been removed."
        action={<Link className="button button-secondary" to="/app/clients">Back to clients</Link>}
      />
    );
  const mine = projects.filter((p) => p.client_id === id);
  return (
    <>
      <PageHeader
        back={{ to: "/app/clients", label: "Clients" }}
        title={
          <span className="title-with-avatar">
            <Avatar name={client.company_name} size="lg" tint /> {client.company_name}
          </span>
        }
        action={
          <Link className="button button-secondary" to={`/app/clients/${id}/edit`}>
            <Pencil size={15} /> Edit
          </Link>
        }
      />
      <div className="meta-row">
        <span>
          <User size={15} /> {client.contact_name}
        </span>
        <a href={`mailto:${client.email}`}>
          <Mail size={15} /> {client.email}
        </a>
      </div>
      {client.notes && <p className="note-box">{client.notes}</p>}
      <section className="card">
        <div className="card-head">
          <h2>Projects</h2>
          {mine.length > 0 && (
            <Link className="button button-primary small" to={`/app/projects/new?client=${id}`}>
              <Plus size={15} /> New project
            </Link>
          )}
        </div>
        {mine.length ? (
          <div className="list">
            {mine.map((p) => (
              <ProjectRow key={p.id} project={p} showClient={false} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<FolderPlus size={26} />}
            title="No projects yet"
            body={`Create a project to start uploading content for ${client.company_name}.`}
            action={
              <Link className="button button-primary" to={`/app/projects/new?client=${id}`}>
                <Plus size={16} /> Create a project
              </Link>
            }
          />
        )}
      </section>
    </>
  );
}
