import { Bell, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../lib/workspace";
export function Topbar() {
  const { clients, projects, assets } = useWorkspace();
  const [query, setQuery] = useState("");
  const results = [
    ...clients.map((c) => ({
      name: c.company_name,
      path: `/app/clients/${c.id}`,
    })),
    ...projects.map((p) => ({ name: p.name, path: `/app/projects/${p.id}` })),
    ...assets.map((a) => ({ name: a.name, path: `/app/assets/${a.id}` })),
  ]
    .filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);
  return (
    <div className="topbar">
      <div className="trial-search">
        <div className="search">
          <Search size={17} />
          <input
            aria-label="Search workspace"
            placeholder="Search clients, projects, assets…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {query && (
          <div className="trial-search-results">
            {results.map((r) => (
              <Link key={r.path} to={r.path} onClick={() => setQuery("")}>
                {r.name}
              </Link>
            ))}
            {!results.length && <p>No matches found.</p>}
          </div>
        )}
      </div>
      <div className="topbar-actions">
        <Link
          aria-label="Recent activity"
          className="icon-button"
          to="/app/activity"
        >
          <Bell size={18} />
        </Link>
        <Link className="button button-primary small" to="/app/approvals/new">
          <Plus size={16} /> New approval
        </Link>
      </div>
    </div>
  );
}
