import { FolderOpen, Image as ImageIcon, Search, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useWorkspace } from "../lib/workspace";

export function Topbar() {
  const { clients, projects, assets } = useWorkspace();
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const location = useLocation();
  useEffect(() => setQuery(""), [location.pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName === "BODY") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const q = query.trim().toLowerCase();
  const results = [
    ...clients.map((c) => ({
      name: c.company_name,
      hint: c.contact_name,
      path: `/app/clients/${c.id}`,
      Icon: Users,
    })),
    ...projects.map((p) => ({
      name: p.name,
      hint: p.company_name,
      path: `/app/projects/${p.id}`,
      Icon: FolderOpen,
    })),
    ...assets.map((a) => ({
      name: a.name,
      hint: projects.find((p) => p.id === a.project_id)?.name ?? "",
      path: `/app/assets/${a.id}`,
      Icon: ImageIcon,
    })),
  ]
    .filter((r) => `${r.name} ${r.hint}`.toLowerCase().includes(q))
    .slice(0, 8);
  return (
    <div className="topbar">
      <div className="search">
        <Search size={17} />
        <input
          ref={input}
          type="search"
          aria-label="Search"
          placeholder="Search clients, projects or files…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQuery("")}
        />
        <kbd>/</kbd>
        {q && (
          <div className="search-results">
            {results.map(({ path, name, hint, Icon }) => (
              <Link key={path} to={path}>
                <Icon size={16} />
                <span>
                  <b>{name}</b>
                  {hint && <small>{hint}</small>}
                </span>
              </Link>
            ))}
            {!results.length && <p>No matches for “{query}”.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
