import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CornerDownLeft,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  LucideIcon,
  Search,
  Send,
  Settings,
  UploadCloud,
  UserPlus,
  Users,
} from "lucide-react";
import { useWorkspace } from "../lib/workspace";

type Row = { id: string; title: string; hint?: string; Icon: LucideIcon; run: () => void };
type Group = { title: string; rows: Row[] };

/**
 * ⌘K launcher: jump to any client, project or file, or start a common action.
 * Fully keyboard-driven (↑ ↓ ↵ esc) and usable by touch on phones.
 */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { clients, projects, assets } = useWorkspace();
  const go = useNavigate();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => input.current?.focus());
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const groups: Group[] = useMemo(() => {
    const open_ = (path: string) => () => {
      onClose();
      go(path);
    };
    const needle = query.trim().toLowerCase();
    const has = (text: string) => !needle || text.toLowerCase().includes(needle);
    const actions: Row[] = [
      { id: "a-send", title: "Send for approval", hint: "Create a private review link", Icon: Send, run: open_("/app/approvals/new") },
      { id: "a-upload", title: "Upload content", hint: "Images, videos and PDFs", Icon: UploadCloud, run: open_("/app/upload") },
      { id: "a-client", title: "Add a client", Icon: UserPlus, run: open_("/app/clients/new") },
      { id: "a-project", title: "New project", Icon: FolderPlus, run: open_("/app/projects/new") },
      { id: "a-settings", title: "Settings", Icon: Settings, run: open_("/app/settings/workspace") },
    ].filter((a) => has(`${a.title} ${a.hint ?? ""}`));
    const found: Group[] = [
      { title: "Actions", rows: needle ? actions : actions.slice(0, 4) },
      {
        title: "Clients",
        rows: clients
          .filter((c) => has(`${c.company_name} ${c.contact_name} ${c.email}`))
          .slice(0, 5)
          .map((c) => ({ id: `c-${c.id}`, title: c.company_name, hint: c.contact_name, Icon: Users, run: open_(`/app/clients/${c.id}`) })),
      },
      {
        title: "Projects",
        rows: projects
          .filter((p) => has(`${p.name} ${p.company_name}`))
          .slice(0, 5)
          .map((p) => ({ id: `p-${p.id}`, title: p.name, hint: p.company_name, Icon: FolderOpen, run: open_(`/app/projects/${p.id}`) })),
      },
      {
        title: "Files",
        rows: assets
          .filter((a) => has(a.name))
          .slice(0, 5)
          .map((a) => ({
            id: `f-${a.id}`,
            title: a.name,
            hint: projects.find((p) => p.id === a.project_id)?.name,
            Icon: ImageIcon,
            run: open_(`/app/assets/${a.id}`),
          })),
      },
    ];
    return found.filter((g) => g.rows.length);
  }, [query, clients, projects, assets, go, onClose]);

  const flat = groups.flatMap((g) => g.rows);
  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [index, groups]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[index]?.run();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  let cursor = -1;
  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search and commands" onClick={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className="palette-input">
          <Search size={18} />
          <input
            ref={input}
            className="bare"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={flat[index] ? `opt-${flat[index].id}` : undefined}
            placeholder="Search clients, projects, files or type a command…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd>esc</kbd>
        </div>
        <div className="palette-list" id="palette-list" role="listbox" ref={list}>
          {groups.map((g) => (
            <div key={g.title} role="group" aria-label={g.title}>
              <p className="palette-group">{g.title}</p>
              {g.rows.map((r) => {
                cursor += 1;
                const mine = cursor;
                return (
                  <button
                    key={r.id}
                    id={`opt-${r.id}`}
                    type="button"
                    role="option"
                    aria-selected={mine === index}
                    className="palette-row"
                    onMouseMove={() => setIndex(mine)}
                    onClick={r.run}
                  >
                    <span className="palette-icon">
                      <r.Icon size={16} />
                    </span>
                    <span className="palette-text">
                      <b>{r.title}</b>
                      {r.hint && <small>{r.hint}</small>}
                    </span>
                    {mine === index && <CornerDownLeft size={14} className="palette-enter" />}
                  </button>
                );
              })}
            </div>
          ))}
          {!groups.length && (
            <p className="palette-empty">
              Nothing matches “{query}”. Try a client, project or file name.
            </p>
          )}
        </div>
        <div className="palette-foot" aria-hidden>
          <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

export type { ReactNode };
