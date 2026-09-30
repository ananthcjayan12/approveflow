import { FormEvent, ReactNode, RefObject, useState } from "react";
import {
  Circle,
  Clock3,
  Highlighter,
  LucideIcon,
  MapPin,
  MessageSquare,
  MessageSquarePlus,
  MoveUpRight,
  Pencil,
  SendHorizontal,
  Square,
  SquareDashedMousePointer,
  X,
} from "lucide-react";
import { Avatar, Notice } from "../ui";
import { api } from "../../lib/api";
import { PlacedComment, Shape, ShapeKind, Span, buildAnnotation, describeShapes } from "../../lib/annotations";
import { formatSpan, formatTime, overlapsPortion } from "../../lib/timeline";
import { timeAgo } from "../../lib/format";
import { AssetRow, CommentRow } from "../../lib/workspace";
import { readableOn } from "../../lib/color";

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

const SHAPE_ICONS: Record<ShapeKind, LucideIcon> = {
  pin: MapPin,
  pen: Pencil,
  highlight: Highlighter,
  rect: Square,
  ellipse: Circle,
  arrow: MoveUpRight,
};

// ---- List -------------------------------------------------------------------

function CommentItem({
  pc,
  active,
  fresh,
  reviewer,
  onPick,
  onHover,
  onSeek,
}: {
  pc: PlacedComment<CommentRow>;
  active: boolean;
  fresh: boolean;
  /** True on the client's page, where studio replies get a "Studio" tag. */
  reviewer: boolean;
  onPick: (id: string) => void;
  onHover: (id: string | null) => void;
  onSeek: (id: string) => void;
}) {
  const c = pc.row;
  const first = pc.shapes[0];
  const Icon = first ? SHAPE_ICONS[first.t] : null;
  const owner = c.author_type === "owner";
  return (
    <li
      id={`comment-${c.id}`}
      className={cx("comment", active && "is-active", fresh && "is-new")}
      onMouseEnter={() => onHover(c.id)}
      onMouseLeave={() => onHover(null)}
    >
      {pc.n ? (
        <button
          type="button"
          className="cbadge"
          style={{ ["--c" as string]: pc.color, ["--on" as string]: readableOn(pc.color) }}
          aria-label={`Show comment ${pc.n} on the media`}
          onClick={() => onPick(c.id)}
        >
          {pc.n}
        </button>
      ) : (
        <Avatar name={c.author_name} size="sm" />
      )}
      <div className="cbody">
        <div className="cmeta">
          <b>{!reviewer && owner ? "You" : c.author_name}</b>
          {reviewer && owner && <span className="tag tone-primary">Studio</span>}
          <time dateTime={c.created_at}>{timeAgo(c.created_at)}</time>
        </div>
        <p>{c.body}</p>
        {(Icon || pc.span) && (
          <div className="cchips">
            {Icon && (
              <span className="chip">
                <Icon size={12} /> {describeShapes(pc.shapes)}
              </span>
            )}
            {pc.span && (
              <button type="button" className="chip is-time" onClick={() => onSeek(c.id)} aria-label={`Jump to ${formatSpan(pc.span)}`}>
                <Clock3 size={12} /> {formatSpan(pc.span)}
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export function CommentList({
  placed,
  older,
  activeId,
  freshId,
  reviewer,
  portion,
  onClearPortion,
  onPick,
  onHover,
  onSeek,
  emptyHint,
}: {
  placed: PlacedComment<CommentRow>[];
  older: CommentRow[];
  activeId: string | null;
  freshId: string | null;
  reviewer: boolean;
  portion: Span | null;
  onClearPortion: () => void;
  onPick: (id: string) => void;
  onHover: (id: string | null) => void;
  onSeek: (id: string) => void;
  emptyHint: string;
}) {
  const shown = portion ? placed.filter((c) => c.span && overlapsPortion(c.span, portion)) : placed;
  return (
    <>
      {portion && (
        <div className="portion-filter" role="status">
          <SquareDashedMousePointer size={15} />
          <span>
            <b>{shown.length}</b> of {placed.length} {placed.length === 1 ? "comment" : "comments"} in{" "}
            <b className="tabular">{formatSpan(portion)}</b>
          </span>
          <button type="button" className="link small" onClick={onClearPortion}>
            Show all
          </button>
        </div>
      )}

      {shown.length > 0 ? (
        <ul className="comments">
          {shown.map((pc) => (
            <CommentItem key={pc.row.id} pc={pc} active={activeId === pc.row.id} fresh={freshId === pc.row.id} reviewer={reviewer} onPick={onPick} onHover={onHover} onSeek={onSeek} />
          ))}
        </ul>
      ) : (
        <div className="thread-empty">
          <span className="thread-empty-icon">
            <MessageSquare size={20} />
          </span>
          <b>{portion ? "Nothing in this portion" : "No comments yet"}</b>
          <p>{portion ? "Drag the handles on the timeline to look at another part, or show everything." : emptyHint}</p>
          {portion && (
            <button type="button" className="button button-secondary small" onClick={onClearPortion}>
              Show all comments
            </button>
          )}
        </div>
      )}

      {!portion && older.length > 0 && (
        <details className="older">
          <summary>Comments on earlier versions ({older.length})</summary>
          {older.map((c) => (
            <p key={c.id}>
              <b>{c.author_name}:</b> {c.body}
            </p>
          ))}
        </details>
      )}
    </>
  );
}

// ---- Composer ---------------------------------------------------------------

function Chip({ icon: Icon, children, onRemove, label, dot }: { icon: LucideIcon; children: ReactNode; onRemove?: () => void; label: string; dot?: string }) {
  return (
    <span className="ctx-chip">
      {dot && <i style={{ background: dot }} />}
      <Icon size={13} />
      <span className="tabular">{children}</span>
      {onRemove && (
        <button type="button" aria-label={label} onClick={onRemove}>
          <X size={12} />
        </button>
      )}
    </span>
  );
}

export type ComposerProps = {
  asset: AssetRow;
  token?: string;
  isVideo: boolean;
  canMark: boolean;
  draft: Shape[];
  markedAt: number | null;
  /** Where the video playhead rests, in seconds. */
  now: number;
  portion: Span | null;
  timestamped: boolean;
  onTimestamped: (on: boolean) => void;
  onClearDraft: () => void;
  onClearPortion: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onFocusText: () => void;
  onPosted: (id?: string) => Promise<void>;
};

export function Composer(p: ComposerProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const anchored = p.draft.length > 0;

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const annotation = p.canMark
        ? buildAnnotation({
            isVideo: p.isVideo,
            shapes: p.draft,
            markedAt: p.markedAt,
            now: p.now,
            portion: p.portion,
            timestamped: p.timestamped,
          })
        : undefined;
      const saved = await api<{ id?: string }>(p.token ? `/api/review/${p.token}/comments` : `/api/assets/${p.asset.id}/comments`, {
        method: "POST",
        body: JSON.stringify({
          assetId: p.asset.id,
          assetVersionId: p.asset.version_id,
          body: text.trim(),
          annotation,
        }),
      });
      setText("");
      await p.onPosted(saved.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const placeholder = anchored
    ? "Say what should change here…"
    : p.isVideo && p.canMark
      ? p.portion
        ? "What should change in this portion?"
        : p.timestamped
          ? `What should change at ${formatTime(p.now)}?`
          : "Write a comment about the whole video…"
      : "Write a comment…";

  return (
    <form className="composer" onSubmit={submit}>
      {p.canMark && (
        <div className="ctx-chips">
          {anchored && (
            <Chip icon={SHAPE_ICONS[p.draft[0].t]} dot={p.draft[0].c} onRemove={p.onClearDraft} label="Remove markup">
              {describeShapes(p.draft)}
            </Chip>
          )}
          {p.isVideo && p.portion && (
            <Chip icon={SquareDashedMousePointer} onRemove={p.onClearPortion} label="Remove selected portion">
              {formatSpan(p.portion, true)}
            </Chip>
          )}
          {p.isVideo && !p.portion && p.timestamped && (
            <Chip icon={Clock3} onRemove={anchored ? undefined : () => p.onTimestamped(false)} label="Comment on the whole video instead">
              At {formatTime(anchored && p.markedAt !== null ? p.markedAt : p.now, true)}
            </Chip>
          )}
          {p.isVideo && !p.portion && !p.timestamped && !anchored && (
            <button type="button" className="ctx-add" onClick={() => p.onTimestamped(true)}>
              <Clock3 size={13} /> Add timestamp
            </button>
          )}
          {!p.isVideo && !anchored && (
            <span className="ctx-hint">
              <MessageSquarePlus size={13} /> Tap the image to pin this comment
            </span>
          )}
        </div>
      )}
      <textarea
        ref={p.textareaRef}
        className="composer-input bare"
        aria-label="Your comment"
        maxLength={10000}
        rows={2}
        value={text}
        placeholder={placeholder}
        onFocus={p.onFocusText}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
        }}
      />
      <Notice message={error} tone="error" />
      <div className="composer-foot">
        <span className="composer-hint">
          <kbd>⌘</kbd>
          <kbd>↵</kbd> to send
        </span>
        <button className="button button-primary small send-btn" disabled={busy || !text.trim()} aria-label="Post comment">
          <span className="send-label">{busy ? "Sending…" : "Comment"}</span> <SendHorizontal size={16} />
        </button>
      </div>
    </form>
  );
}
