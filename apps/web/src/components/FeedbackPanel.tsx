import { FormEvent, useRef, useState } from "react";
import { Clock3, ExternalLink, MapPin, MousePointerClick, X } from "lucide-react";
import { Avatar, Notice } from "./ui";
import { api } from "../lib/api";
import { formatSeconds, timeAgo } from "../lib/format";
import { AssetRow, CommentRow, mediaUrl } from "../lib/workspace";

/**
 * The media viewer + comment thread shared by the client review page and the
 * agency's own asset page. Clients (token set) can pin comments on images and
 * attach them to video moments; the agency can reply in plain text.
 */
export function FeedbackPanel({
  asset,
  comments,
  token,
  canComment = true,
  disabledReason,
  onSave,
}: {
  asset: AssetRow;
  comments: CommentRow[];
  token?: string;
  canComment?: boolean;
  disabledReason?: string;
  onSave: () => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [range, setRange] = useState(false);
  const [end, setEnd] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const annotate = !!token && canComment;

  const current = comments.filter((c) => c.asset_version_id === asset.version_id);
  const old = comments.filter((c) => c.asset_version_id !== asset.version_id);
  const pinned = current.filter((c) => c.x !== null && c.y !== null);
  const pinNo = (c: CommentRow) => pinned.indexOf(c) + 1;
  const now = () => video.current?.currentTime || 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      if (range && end <= time) throw new Error("The end time needs to be after the start time.");
      const annotation = !annotate
        ? undefined
        : point
          ? { kind: "point", ...point }
          : asset.kind === "video"
            ? range
              ? { kind: "video_range", startMs: Math.round(time * 1000), endMs: Math.round(end * 1000) }
              : { kind: "video_timestamp", timestampMs: Math.round(time * 1000) }
            : undefined;
      await api(token ? `/api/review/${token}/comments` : `/api/assets/${asset.id}/comments`, {
        method: "POST",
        body: JSON.stringify({
          assetId: asset.id,
          assetVersionId: asset.version_id,
          body: text.trim(),
          annotation,
        }),
      });
      setText("");
      setPoint(null);
      setRange(false);
      await onSave();
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const src = mediaUrl(asset, token);
  const seek = (c: CommentRow) => {
    if (video.current) {
      video.current.currentTime = (c.timestamp_ms ?? c.start_ms ?? 0) / 1000;
      void video.current.play().catch(() => undefined);
    }
  };

  return (
    <div className="review-layout">
      <section className="stage">
        {asset.kind === "video" ? (
          <video
            ref={video}
            src={src}
            controls
            playsInline
            className="stage-video"
            onPause={() => !range && setTime(now())}
            onSeeked={() => !range && setTime(now())}
          />
        ) : asset.kind === "pdf" ? (
          <iframe className="stage-pdf" title={asset.name} src={src} />
        ) : (
          <div
            className={`pin-surface ${annotate ? "can-pin" : ""}`}
            onClick={(e) => {
              if (!annotate) return;
              const r = e.currentTarget.getBoundingClientRect();
              setPoint({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
              setActive(null);
              setTimeout(() => box.current?.focus(), 0);
            }}
          >
            <img src={src} alt={asset.name} draggable={false} />
            {pinned.map((c) => (
              <button
                type="button"
                key={c.id}
                title={c.body}
                className={`pin ${active === c.id ? "active" : ""}`}
                style={{ left: `${c.x! * 100}%`, top: `${c.y! * 100}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActive(c.id);
                  document.getElementById(`comment-${c.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                }}
              >
                {pinNo(c)}
              </button>
            ))}
            {point && (
              <span className="pin pending" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}>
                {pinned.length + 1}
              </span>
            )}
          </div>
        )}
        {annotate && asset.kind !== "video" && asset.kind !== "pdf" && !point && (
          <p className="stage-hint">
            <MousePointerClick size={16} /> Tip: tap anywhere on the image to comment on that exact spot.
          </p>
        )}
        {annotate && asset.kind === "pdf" && (
          <p className="stage-hint">Tip: mention the page number in your comment.</p>
        )}
        <a className="link small open-original" href={src} target="_blank" rel="noreferrer">
          <ExternalLink size={14} /> Open full size
        </a>
      </section>

      <aside className="thread">
        {asset.caption && (
          <div className="caption-box">
            <span className="field-label">Caption</span>
            <p>{asset.caption}</p>
          </div>
        )}
        <div className="thread-head">
          <h3>Comments</h3>
          <span className="count">{current.length}</span>
        </div>
        <ul className="comments">
          {current.map((c) => {
            const n = pinNo(c);
            const at = c.timestamp_ms ?? c.start_ms;
            return (
              <li
                key={c.id}
                id={`comment-${c.id}`}
                className={active === c.id ? "active" : ""}
                onMouseEnter={() => setActive(c.id)}
                onMouseLeave={() => setActive(null)}
              >
                {n > 0 ? <span className="pin static">{n}</span> : <Avatar name={c.author_name} size="sm" />}
                <div>
                  <div className="comment-meta">
                    <b>{!token && c.author_type === "owner" ? "You" : c.author_name}</b>
                    <time>{timeAgo(c.created_at)}</time>
                  </div>
                  <p>{c.body}</p>
                  {at !== null && at !== undefined && (
                    <button type="button" className="time-chip" onClick={() => seek(c)}>
                      <Clock3 size={12} /> {formatSeconds(at / 1000)}
                      {c.end_ms !== null && ` – ${formatSeconds(c.end_ms / 1000)}`}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {!current.length && (
          <p className="muted small thread-empty">
            {token ? "No comments yet. Happy with it? Just tap Approve." : "No comments on this version yet."}
          </p>
        )}
        {old.length > 0 && (
          <details className="older">
            <summary>Comments on earlier versions ({old.length})</summary>
            {old.map((c) => (
              <p key={c.id}>
                <b>{c.author_name}:</b> {c.body}
              </p>
            ))}
          </details>
        )}

        {canComment ? (
          <form className="composer" onSubmit={submit}>
            {point && (
              <div className="composer-context">
                <MapPin size={14} /> Commenting on pin {pinned.length + 1}
                <button type="button" aria-label="Remove pin" onClick={() => setPoint(null)}>
                  <X size={14} />
                </button>
              </div>
            )}
            {annotate && asset.kind === "video" && (
              <div className="composer-context">
                <Clock3 size={14} />
                {range ? (
                  <>
                    <button type="button" className="time-chip" onClick={() => setTime(now())} title="Set start to current time">
                      {formatSeconds(time)}
                    </button>
                    →
                    <button type="button" className="time-chip" onClick={() => setEnd(now())} title="Set end to current time">
                      {formatSeconds(end)}
                    </button>
                    <button type="button" className="link small" onClick={() => setRange(false)}>
                      Single moment
                    </button>
                  </>
                ) : (
                  <>
                    At {formatSeconds(time)}
                    <button
                      type="button"
                      className="link small"
                      onClick={() => {
                        setRange(true);
                        setEnd(Math.min(time + 3, video.current?.duration || time + 3));
                      }}
                    >
                      Mark a range
                    </button>
                  </>
                )}
              </div>
            )}
            <textarea
              ref={box}
              aria-label="Your comment"
              maxLength={10000}
              rows={3}
              value={text}
              onFocus={() => {
                if (asset.kind === "video" && video.current && !video.current.paused) {
                  video.current.pause();
                }
              }}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit(e);
              }}
              placeholder={
                point
                  ? "What should change here?"
                  : asset.kind === "video" && annotate
                    ? "Pause the video where you want to comment…"
                    : "Write a comment…"
              }
            />
            <Notice message={message} tone="error" />
            <button className="button button-secondary full" disabled={busy || !text.trim()}>
              {busy ? "Posting…" : "Post comment"}
            </button>
          </form>
        ) : (
          disabledReason && <p className="hint-box">{disabledReason}</p>
        )}
      </aside>
    </div>
  );
}
