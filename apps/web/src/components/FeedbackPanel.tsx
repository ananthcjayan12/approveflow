import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { AlertCircle, ChevronDown, ChevronUp, ExternalLink, MessageSquare, X } from "lucide-react";
import { Avatar } from "./ui";
import { Annotator, Marked } from "./review/Annotator";
import { Composer, CommentList } from "./review/CommentsPanel";
import { MarkupToolbar, TOOLS } from "./review/MarkupToolbar";
import { VideoStage } from "./review/VideoStage";
import { DEFAULT_COLORS, Shape, SizeKey, Span, ToolId, placeComments } from "../lib/annotations";
import { formatSpan } from "../lib/timeline";
import { isTyping, keyboardOwnsControl, useKeyboardInset, useMediaQuery, useWindowKey } from "../lib/hooks";
import { timeAgo } from "../lib/format";
import { AssetRow, CommentRow, mediaUrl } from "../lib/workspace";

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");
type Sheet = "peek" | "compose" | "full";

/**
 * The review workspace: media stage with markup tools, the comment thread and
 * composer. Shared by the client's review page and the designer's asset page.
 *
 * Reviewers can pin, draw, highlight and box things on images; on video they can
 * comment on a moment, select a portion of the timeline, and mark up the frame.
 */
export function FeedbackPanel({
  asset,
  comments,
  token,
  canComment = true,
  disabledReason,
  onSave,
  stageHeader,
  className,
}: {
  asset: AssetRow;
  comments: CommentRow[];
  token?: string;
  canComment?: boolean;
  disabledReason?: string;
  onSave: () => Promise<void>;
  /** Rendered at the top of the stage (title, pager, status). */
  stageHeader?: ReactNode;
  className?: string;
}) {
  const isVideo = asset.kind === "video";
  const isPdf = asset.kind === "pdf";
  const reviewer = !!token;
  const canMark = canComment && !isPdf;
  const src = mediaUrl(asset, token);
  const narrow = useMediaQuery("(max-width: 899px)");
  useKeyboardInset();

  const current = useMemo(() => comments.filter((c) => c.asset_version_id === asset.version_id), [comments, asset.version_id]);
  const older = useMemo(() => comments.filter((c) => c.asset_version_id !== asset.version_id), [comments, asset.version_id]);
  const placed = useMemo(() => placeComments(current), [current]);
  const numbered = placed.filter((c) => c.n !== null).length;

  // Tools & pending markup
  const [tool, setTool] = useState<ToolId>(isVideo ? "hand" : "pin");
  const [inks, setInks] = useState<Record<string, string>>({ ...DEFAULT_COLORS });
  const [size, setSize] = useState<SizeKey>("M");
  const [draft, setDraft] = useState<Shape[]>([]);
  const [markedAt, setMarkedAt] = useState<number | null>(null);
  const [portion, setPortion] = useState<Span | null>(null);
  const [timestamped, setTimestamped] = useState(true);
  const [settled, setSettled] = useState(0);

  // Linking the thread and the media
  const [hover, setHover] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const activeId = hover ?? picked ?? fresh;

  const [sheet, setSheet] = useState<Sheet>("peek");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  const ink = tool === "hand" ? inks.pen : inks[tool];
  const setInk = (color: string) => tool !== "hand" && setInks((prev) => ({ ...prev, [tool]: color }));

  const focusComposer = useCallback(() => {
    if (narrow) flushSync(() => setSheet((s) => (s === "full" ? s : "compose")));
    textRef.current?.focus({ preventScroll: true });
  }, [narrow]);

  const addShape = (shape: Shape, time?: number) => {
    setDraft((d) => (shape.t === "pin" ? [...d.filter((s) => s.t !== "pin"), shape] : [...d, shape]));
    if (isVideo && time !== undefined) setMarkedAt((m) => m ?? time);
    setPicked(null);
    if (narrow) setSheet((s) => (s === "peek" ? "compose" : s));
    // A pin is a complete gesture, so go straight to writing. Strokes are not:
    // people usually draw several before typing.
    if (shape.t === "pin") focusComposer();
  };

  const undo = () =>
    setDraft((d) => {
      const next = d.slice(0, -1);
      if (!next.length) setMarkedAt(null);
      return next;
    });
  const clearDraft = () => {
    setDraft([]);
    setMarkedAt(null);
  };
  const setPortionAndSheet = useCallback(
    (span: Span | null) => {
      setPortion(span);
      if (span && narrow) setSheet((s) => (s === "peek" ? "compose" : s));
    },
    [narrow],
  );

  const pick = useCallback(
    (id: string) => {
      setPicked(id);
      const span = placed.find((c) => c.row.id === id)?.span;
      if (isVideo && span && videoRef.current) videoRef.current.currentTime = span.start;
      document.getElementById(`comment-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
    [placed, isVideo],
  );

  const onPosted = async (id?: string) => {
    clearDraft();
    setPortion(null);
    setTimestamped(true);
    await onSave();
    setSheet((s) => (s === "compose" ? "peek" : s));
    if (id) {
      setFresh(id);
      setPicked(null);
      requestAnimationFrame(() => document.getElementById(`comment-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    }
  };
  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => setFresh(null), 2400);
    return () => clearTimeout(t);
  }, [fresh]);

  // Shortcuts (Enter to comment, tool letters, undo, Esc)
  useWindowKey((e) => {
    if (isTyping(e.target)) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && canMark) {
      e.preventDefault();
      undo();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Escape") {
      if (portion) setPortion(null);
      else if (draft.length) clearDraft();
      else if (tool !== "hand" && isVideo) setTool("hand");
      setPicked(null);
      return;
    }
    if (e.key === "Enter" && canComment && !keyboardOwnsControl(e.target)) {
      e.preventDefault();
      focusComposer();
      return;
    }
    if (!canMark) return;
    const hit = TOOLS.find((t) => t.key.toLowerCase() === e.key.toLowerCase());
    if (hit) {
      e.preventDefault();
      setTool(hit.id);
    }
  });

  // Media-specific stage content
  const marks: Marked[] = useMemo(
    () => placed.filter((c) => c.shapes.length).map((c) => ({ id: c.row.id, n: c.n, shapes: c.shapes, color: c.color, anchor: c.anchor })),
    [placed],
  );
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const pickedComment = picked ? placed.find((c) => c.row.id === picked) : null;

  const emptyHint = !canComment
    ? "Comments will show up here once this has been sent."
    : reviewer
      ? isVideo
        ? "Pause on a moment to comment, or drag along the timeline to select a portion. Happy with it? Just tap Approve."
        : isPdf
          ? "Write a note below (mention the page number). Happy with it? Just tap Approve."
          : "Tap the image to drop a pin, or draw and highlight what should change. Happy with it? Just tap Approve."
      : "No comments on this version yet.";

  const total = current.length;

  return (
    <div className={cx("workspace", className)} data-kind={asset.kind}>
      <section className="stage" ref={stageRef}>
        {stageHeader}

        {canMark && (
          <MarkupToolbar
            tool={tool}
            onTool={setTool}
            color={ink}
            onColor={setInk}
            size={size}
            onSize={setSize}
            canUndo={draft.length > 0}
            onUndo={undo}
            onClear={clearDraft}
            handLabel={isVideo ? "Play" : "Move"}
          />
        )}

        <div className="stage-body">
          {isPdf ? (
            <>
              <iframe className="pdf-frame" title={asset.name} src={src} />
              <a className="button button-glass small pdf-open" href={src} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> Open PDF
              </a>
            </>
          ) : isVideo ? (
            <VideoStage
              src={src}
              videoRef={videoRef}
              stageRef={stageRef}
              placed={placed}
              draft={draft}
              draftTime={markedAt}
              draftNumber={numbered + 1}
              tool={tool}
              color={ink}
              size={size}
              canMark={canMark}
              activeId={activeId}
              selection={portion}
              onSelection={setPortionAndSheet}
              onDraw={addShape}
              onHover={setHover}
              onPick={pick}
              onSettle={setSettled}
            />
          ) : (
            <Annotator
              media={natural}
              tool={tool}
              color={ink}
              size={size}
              marks={marks}
              draft={draft}
              draftNumber={numbered + 1}
              activeId={activeId}
              interactive={canMark}
              zoomable
              onBackgroundTap={() => setPicked(null)}
              onDraw={addShape}
              onHover={setHover}
              onPick={pick}
              overlay={
                imageFailed && (
                  <div className="media-error" role="alert">
                    <AlertCircle size={22} />
                    <b>This image couldn’t be loaded</b>
                    <span>Check your connection, then try again or open the original file.</span>
                    <div className="media-error-actions">
                      <button className="button button-glass small" onClick={() => setImageFailed(false)}>
                        Try again
                      </button>
                      <a className="button button-glass small" href={src} target="_blank" rel="noreferrer">
                        Open original
                      </a>
                    </div>
                  </div>
                )
              }
            >
              <img
                key={String(imageFailed)}
                className="media"
                src={src}
                alt={asset.name}
                draggable={false}
                onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                onError={() => setImageFailed(true)}
              />
            </Annotator>
          )}

          {narrow && pickedComment && (
            <div className="pick-card" role="status">
              {pickedComment.n ? (
                <span className="cbadge" style={{ ["--c" as string]: pickedComment.color }}>
                  {pickedComment.n}
                </span>
              ) : (
                <Avatar name={pickedComment.row.author_name} size="sm" />
              )}
              <div>
                <b>{pickedComment.row.author_name}</b> <time>{timeAgo(pickedComment.row.created_at)}</time>
                <p>{pickedComment.row.body}</p>
                {pickedComment.span && <span className="chip is-time">{formatSpan(pickedComment.span)}</span>}
              </div>
              <button type="button" className="icon-button ghost" aria-label="Close" onClick={() => setPicked(null)}>
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      </section>

      {narrow && sheet === "full" && <div className="sheet-backdrop" onClick={() => setSheet("peek")} />}

      <aside className={cx("panel", narrow && `sheet-${sheet}`)} aria-label="Comments">
        {narrow && (
          <div className="sheet-handle">
            <button
              type="button"
              className="sheet-title"
              aria-expanded={sheet === "full"}
              onClick={() => setSheet(sheet === "peek" ? "full" : "peek")}
            >
              <span className="grip" aria-hidden />
              <MessageSquare size={16} />
              <b>{sheet === "compose" ? "New comment" : "Comments"}</b>
              {sheet !== "compose" && <span className="count">{total}</span>}
            </button>
            <button
              type="button"
              className="sheet-action"
              onClick={() => {
                if (sheet === "peek") {
                  if (canComment) focusComposer();
                  else setSheet("full");
                } else if (sheet === "compose") setSheet("full");
                else setSheet("peek");
              }}
            >
              {sheet === "peek" ? (canComment ? "Add comment" : "View") : sheet === "compose" ? `View all (${total})` : "Close"}
              {sheet === "full" ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
        )}

        <div className="panel-body">
          {asset.caption && (
            <div className="caption-box">
              <span className="field-label">Caption</span>
              <p>{asset.caption}</p>
            </div>
          )}
          {!narrow && (
            <div className="panel-head">
              <h2 className="panel-title">Comments</h2>
              <span className="count">{total}</span>
            </div>
          )}
          <CommentList
            placed={placed}
            older={older}
            activeId={activeId}
            freshId={fresh}
            reviewer={reviewer}
            portion={portion}
            onClearPortion={() => setPortion(null)}
            onPick={pick}
            onHover={setHover}
            onSeek={pick}
            emptyHint={emptyHint}
          />
        </div>

        {canComment ? (
          <Composer
            asset={asset}
            token={token}
            isVideo={isVideo}
            canMark={canMark}
            draft={draft}
            markedAt={markedAt}
            now={settled}
            portion={portion}
            timestamped={timestamped}
            onTimestamped={setTimestamped}
            onClearDraft={clearDraft}
            onClearPortion={() => setPortion(null)}
            textareaRef={textRef}
            onFocusText={() => isVideo && videoRef.current?.pause()}
            onPosted={onPosted}
          />
        ) : (
          disabledReason && <p className="hint-box panel-hint">{disabledReason}</p>
        )}
      </aside>
    </div>
  );
}
