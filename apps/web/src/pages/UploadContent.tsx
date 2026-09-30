import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  FileText,
  Film,
  FolderPlus,
  Image as ImageIcon,
  Send,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { EmptyState, Field, Notice, PageHeader, ProgressBar, Thumb } from "../components/ui";
import { api, uploadFile } from "../lib/api";
import { formatBytes } from "../lib/format";
import { useWorkspace } from "../lib/workspace";

const ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm,application/pdf";
const supported = (file: File) => ACCEPT.split(",").includes(file.type);
const kindOf = (file: File) =>
  file.type.startsWith("video/") ? "video" : file.type === "application/pdf" ? "pdf" : "image";

type Item = {
  file: File;
  preview?: string;
  state: "queued" | "uploading" | "done" | "error";
  pct: number;
  assetId?: string;
};

function FileIcon({ item }: { item: Item }) {
  if (item.preview) return <img src={item.preview} alt="" />;
  const kind = kindOf(item.file);
  return kind === "video" ? <Film size={20} /> : kind === "pdf" ? <FileText size={20} /> : <ImageIcon size={20} />;
}

export default function UploadContent() {
  const { projects, assets, clients, reload } = useWorkspace();
  const [params] = useSearchParams();
  const revision = assets.find((a) => a.id === params.get("asset"));
  const [project, setProject] = useState(
    revision?.project_id || params.get("project") || projects[0]?.id || "",
  );
  const [items, setItems] = useState<Item[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [caption, setCaption] = useState("");
  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach(URL.revokeObjectURL), []);

  const current = projects.find((p) => p.id === project);
  const client = clients.find((c) => c.id === current?.client_id);
  const finished = items.length > 0 && items.every((i) => i.state === "done");

  const add = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const rejected = incoming.filter((f) => !supported(f));
    setMessage(
      rejected.length
        ? `${rejected.map((f) => f.name).join(", ")} can’t be uploaded. Use JPG, PNG, WebP, GIF, MP4, MOV, WebM or PDF.`
        : "",
    );
    const next = incoming.filter(supported).map((file) => {
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      if (preview) previews.current.push(preview);
      return { file, preview, state: "queued", pct: 0 } as Item;
    });
    setItems((v) => (revision ? next.slice(0, 1) : [...v, ...next]));
  };
  const patch = (index: number, change: Partial<Item>) =>
    setItems((v) => v.map((item, i) => (i === index ? { ...item, ...change } : item)));

  const upload = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      for (const [index, item] of items.entries()) {
        if (item.state === "done") continue;
        patch(index, { state: "uploading", pct: 0 });
        try {
          const result = await uploadFile(item.file, (pct) => patch(index, { pct }));
          const saved = await api<{ assetId: string }>("/api/assets/finalize-upload", {
            method: "POST",
            body: JSON.stringify({
              projectId: project,
              assetId: revision?.id,
              name: revision?.name || item.file.name.replace(/\.[^.]+$/, ""),
              kind: kindOf(item.file),
              r2Key: result.key,
              mimeType: item.file.type,
              size: item.file.size,
              caption,
            }),
          });
          patch(index, { state: "done", pct: 100, assetId: saved.assetId });
        } catch (err) {
          patch(index, { state: "error" });
          throw err;
        }
      }
      await reload();
    } catch (err) {
      setMessage(`${(err as Error).message} You can retry — finished files won’t upload twice.`);
    } finally {
      setBusy(false);
    }
  };

  if (!projects.length)
    return (
      <>
        <PageHeader title="Upload content" />
        <div className="card">
          <EmptyState
            icon={<FolderPlus size={26} />}
            title="Create a project first"
            body="Files live inside a project, so you can send them to the right client."
            action={<Link className="button button-primary" to="/app/projects/new">Create a project</Link>}
          />
        </div>
      </>
    );

  if (finished) {
    const ids = items.map((i) => i.assetId).filter(Boolean).join(",");
    return (
      <>
        <PageHeader title={revision ? "New version uploaded" : "Upload complete"} />
        <div className="card success-card">
          <span className="success-icon">
            <CheckCircle2 size={34} />
          </span>
          {revision ? (
            <>
              <h2>Version {revision.latest_version_no} of “{revision.name}” is live</h2>
              <p>Your client will see the new version on the review link they already have.</p>
              <div className="form-actions center">
                <Link className="button button-secondary" to={`/app/assets/${revision.id}`}>
                  View file
                </Link>
                <Link
                  className="button button-primary"
                  to={`/app/approvals/new?project=${project}&assets=${revision.id}`}
                >
                  <Send size={16} /> Send a fresh link
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2>
                {items.length} {items.length === 1 ? "file" : "files"} uploaded to {current?.name}
              </h2>
              <p>Next step: send them to {client?.contact_name || "your client"} so they can approve or comment.</p>
              <div className="form-actions center">
                <button className="button button-secondary" onClick={() => setItems([])}>
                  Upload more
                </button>
                <Link className="button button-primary" to={`/app/approvals/new?project=${project}&assets=${ids}`}>
                  <Send size={16} /> Send for approval
                </Link>
              </div>
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={revision ? "Upload a new version" : "Upload content"}
        description={
          revision
            ? "Replace the file your client asked you to change. Their comments stay attached to the old version."
            : "Add images, videos or PDFs. You’ll send them for approval in the next step."
        }
        back={
          revision
            ? { to: `/app/assets/${revision.id}`, label: revision.name }
            : current
              ? { to: `/app/projects/${current.id}`, label: current.name }
              : undefined
        }
      />
      <form className="card form upload-form" onSubmit={upload}>
        {revision ? (
          <div className="revision-banner">
            <span className="thumb thumb-sm">
              <Thumb asset={revision} />
            </span>
            <div>
              <b>{revision.name}</b>
              <span>
                Currently version {revision.latest_version_no} · will become version {revision.latest_version_no + 1}
              </span>
            </div>
          </div>
        ) : (
          <Field label="Which project is this for?">
            <select value={project} disabled={busy} onChange={(e) => setProject(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.company_name} — {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <label
          className={`dropzone ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!busy) add(e.dataTransfer.files);
          }}
        >
          <span className="dropzone-icon">
            <UploadCloud size={28} />
          </span>
          <b>{dragging ? "Drop to add" : revision ? "Drag the new file here" : "Drag files here"}</b>
          <span>
            or <u>browse your computer</u> · JPG, PNG, GIF, MP4, MOV, PDF
          </span>
          <input
            type="file"
            className="visually-hidden"
            multiple={!revision}
            disabled={busy}
            accept={ACCEPT}
            onChange={(e) => {
              add(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {items.length > 0 && (
          <ul className="file-list">
            {items.map((item, index) => (
              <li key={`${item.file.name}-${index}`} className={`file-${item.state}`}>
                <span className="file-icon">
                  <FileIcon item={item} />
                </span>
                <div className="file-info">
                  <b>{item.file.name}</b>
                  {item.state === "uploading" ? (
                    <ProgressBar value={item.pct} label={`Uploading ${item.file.name}`} />
                  ) : (
                    <small>
                      {formatBytes(item.file.size)}
                      {item.state === "error" && " · Upload failed"}
                    </small>
                  )}
                </div>
                {item.state === "done" ? (
                  <CheckCircle2 size={20} className="text-green" aria-label="Uploaded" />
                ) : (
                  !busy && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove ${item.file.name}`}
                      onClick={() => setItems((v) => v.filter((_, i) => i !== index))}
                    >
                      <Trash2 size={16} />
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && (
          <Field label="Caption" optional hint="The post text your client should review along with the visuals.">
            <textarea rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </Field>
        )}

        <Notice message={message} tone="error" />
        <div className="form-actions">
          <button className="button button-primary large" disabled={busy || !items.length}>
            {busy
              ? "Uploading…"
              : items.length
                ? `Upload ${items.length} ${items.length === 1 ? "file" : "files"}`
                : "Choose files to upload"}
          </button>
        </div>
      </form>
    </>
  );
}
