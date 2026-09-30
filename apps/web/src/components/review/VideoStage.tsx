import {
  KeyboardEvent as ReactKeyboardEvent,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Maximize,
  Minimize,
  Pause,
  Play,
  SquareDashedMousePointer,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { PlacedComment, Shape, SizeKey, Span, ToolId } from "../../lib/annotations";
import { isTyping, keyboardOwnsControl, useElementSize, useWindowKey } from "../../lib/hooks";
import { MIN_PORTION, assignLanes, clamp, formatLength, formatSpan, formatTime, isActiveAt, overlapsPortion } from "../../lib/timeline";
import { Popover } from "../Popover";
import { readableOn } from "../../lib/color";
import { Annotator, Marked } from "./Annotator";

const FRAME = 1 / 30;
const RATES = [1, 1.5, 2, 0.5];
const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

// ---- Clock ----------------------------------------------------------------

type Clock = {
  time: number;
  duration: number;
  playing: boolean;
  ended: boolean;
  buffered: number;
  muted: boolean;
  rate: number;
  waiting: boolean;
  failed: boolean;
  size: { w: number; h: number } | null;
};

const bufferedEnd = (v: HTMLVideoElement) => {
  for (let i = 0; i < v.buffered.length; i++)
    if (v.buffered.start(i) <= v.currentTime + 0.25 && v.buffered.end(i) >= v.currentTime) return v.buffered.end(i);
  return 0;
};

/** Mirrors the <video> element into React state at ~14 fps (smooth enough with a CSS transition). */
function useVideoClock(video: HTMLVideoElement | null): Clock {
  const [state, setState] = useState<Clock>({
    time: 0,
    duration: 0,
    playing: false,
    ended: false,
    buffered: 0,
    muted: false,
    rate: 1,
    waiting: false,
    failed: false,
    size: null,
  });
  useEffect(() => {
    if (!video) return;
    let raf = 0;
    let last = 0;
    const read = (extra: Partial<Clock> = {}) =>
      setState((prev) => ({
        ...prev,
        time: video.currentTime,
        duration: Number.isFinite(video.duration) ? video.duration : prev.duration,
        playing: !video.paused && !video.ended,
        ended: video.ended,
        muted: video.muted,
        rate: video.playbackRate,
        buffered: bufferedEnd(video),
        size: video.videoWidth ? { w: video.videoWidth, h: video.videoHeight } : prev.size,
        ...extra,
      }));
    const loop = (t: number) => {
      if (t - last > 70) {
        last = t;
        read();
      }
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
      read({ waiting: false });
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      read();
    };
    const plain = () => read();
    const listeners: Array<[string, EventListener]> = [
      ...["loadedmetadata", "durationchange", "seeked", "seeking", "ratechange", "volumechange", "progress", "emptied"].map(
        (ev): [string, EventListener] => [ev, plain],
      ),
      ["play", start],
      ["playing", start],
      ["pause", stop],
      ["ended", stop],
      ["waiting", () => read({ waiting: true })],
      ["canplay", () => read({ waiting: false, failed: false })],
      ["error", () => read({ failed: true, waiting: false })],
    ];
    listeners.forEach(([ev, fn]) => video.addEventListener(ev, fn));
    read();
    if (!video.paused) start();
    return () => {
      cancelAnimationFrame(raf);
      listeners.forEach(([ev, fn]) => video.removeEventListener(ev, fn));
    };
  }, [video]);
  return state;
}

// ---- Timeline ---------------------------------------------------------------

type TimelineMarker = { id: string; n: number | null; span: Span; color: string };

function Timeline({
  clock,
  markers,
  selection,
  activeId,
  onSeek,
  onSelection,
  onMarker,
  onScrub,
}: {
  clock: Clock;
  markers: TimelineMarker[];
  selection: Span | null;
  activeId: string | null;
  onSeek: (t: number) => void;
  onSelection: (span: Span | null) => void;
  onMarker: (id: string) => void;
  onScrub: (scrubbing: boolean) => void;
}) {
  const { duration, time } = clock;
  const [setInner, inner, innerNode] = useElementSize<HTMLDivElement>();
  const drag = useRef<null | {
    mode: "scrub" | "pending" | "select" | "start" | "end";
    x0: number;
    t0: number;
  }>(null);
  const [scrubbing, setScrubbing] = useState(false);

  const spans = useMemo(() => markers.map((m) => m.span), [markers]);
  const { lanes, count } = useMemo(() => assignLanes(spans, duration, inner.w), [spans, duration, inner.w]);
  const laneH = count * 26;
  const pct = (t: number) => (duration ? (clamp(t, 0, duration) / duration) * 100 : 0);

  const timeAt = (clientX: number) => {
    const r = innerNode!.getBoundingClientRect();
    return clamp((clientX - r.left) / r.width, 0, 1) * duration;
  };

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!duration || !innerNode || (e.pointerType === "mouse" && e.button !== 0)) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-marker]")) return;
    const handle = target.closest("[data-handle]")?.getAttribute("data-handle") as "start" | "end" | null;
    const r = innerNode.getBoundingClientRect();
    const inLane = e.clientY - r.top < laneH;
    e.currentTarget.setPointerCapture(e.pointerId);
    const t = timeAt(e.clientX);
    if (handle) {
      drag.current = { mode: handle, x0: e.clientX, t0: t };
      onScrub(true);
      setScrubbing(true);
    } else if (inLane) {
      drag.current = { mode: "pending", x0: e.clientX, t0: t };
    } else {
      drag.current = { mode: "scrub", x0: e.clientX, t0: t };
      onScrub(true);
      setScrubbing(true);
      onSeek(t);
    }
  };

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !duration) return;
    const t = timeAt(e.clientX);
    if (d.mode === "scrub") {
      onSeek(t);
    } else if (d.mode === "pending") {
      if (Math.abs(e.clientX - d.x0) < 5) return;
      d.mode = "select";
      onScrub(true);
      setScrubbing(true);
    }
    if (d.mode === "select") {
      const start = Math.min(d.t0, t);
      const end = Math.max(d.t0, t);
      onSelection({ start, end: Math.max(end, start + MIN_PORTION) });
      onSeek(t);
    } else if (d.mode === "start" && selection) {
      const start = clamp(t, 0, selection.end - MIN_PORTION);
      onSelection({ start, end: selection.end });
      onSeek(start);
    } else if (d.mode === "end" && selection) {
      const end = clamp(t, selection.start + MIN_PORTION, duration);
      onSelection({ start: selection.start, end });
      onSeek(end);
    }
  };

  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.mode === "pending") {
      // A plain click in the comment lane just moves the playhead.
      const t = timeAt(e.clientX);
      onSeek(t);
      if (selection && (t < selection.start || t > selection.end)) onSelection(null);
      return;
    }
    onScrub(false);
    setScrubbing(false);
  };

  const key = (e: ReactKeyboardEvent) => {
    const step = e.shiftKey ? 5 : 1;
    if (e.key === "ArrowLeft") onSeek(time - step);
    else if (e.key === "ArrowRight") onSeek(time + step);
    else if (e.key === "Home") onSeek(0);
    else if (e.key === "End") onSeek(duration);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className={cx("tl", scrubbing && "is-scrubbing")}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <div className="tl-inner" ref={setInner}>
        <div className="tl-lane" style={{ height: laneH }}>
          {markers.map((m, i) => {
            const range = m.span.end - m.span.start >= 0.05;
            const dim = !!selection && !overlapsPortion(m.span, selection);
            return (
              <button
                key={m.id}
                type="button"
                data-marker
                className={cx("tl-marker", range && "is-range", activeId === m.id && "is-active", dim && "is-dim")}
                style={{
                  left: `${pct(m.span.start)}%`,
                  width: range ? `${pct(m.span.end) - pct(m.span.start)}%` : undefined,
                  top: lanes[i] * 26,
                  ["--c" as string]: m.color,
                  ["--on" as string]: readableOn(m.color),
                }}
                aria-label={`Comment ${m.n} at ${formatSpan(m.span)}`}
                data-tip={formatSpan(m.span)}
                data-tip-pos="top"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarker(m.id);
                }}
              >
                <span>{m.n}</span>
              </button>
            );
          })}
          {!markers.length && !selection && duration > 0 && <span className="tl-hint">Drag here to select a portion</span>}
        </div>

        <div
          className="tl-track"
          role="slider"
          tabIndex={0}
          aria-label="Video position"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
          onKeyDown={key}
        >
          <div className="tl-buffered" style={{ width: `${pct(clock.buffered)}%` }} />
          <div className="tl-played" style={{ width: `${pct(time)}%` }} />
        </div>

        {selection && (
          <div className="tl-selection" style={{ left: `${pct(selection.start)}%`, width: `${pct(selection.end) - pct(selection.start)}%` }}>
            <span className="tl-selection-label">
              {formatSpan(selection, true)} · {formatLength(selection.end - selection.start)}
            </span>
            <span className="tl-handle is-start" data-handle="start" aria-label="Portion start" />
            <span className="tl-handle is-end" data-handle="end" aria-label="Portion end" />
          </div>
        )}

        <div className="tl-playhead" style={{ left: `${pct(time)}%` }} aria-hidden>
          <span />
        </div>
      </div>
    </div>
  );
}

// ---- Stage ------------------------------------------------------------------

type Props = {
  src: string;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  stageRef: MutableRefObject<HTMLElement | null>;
  placed: PlacedComment[];
  draft: Shape[];
  draftTime: number | null;
  draftNumber: number;
  tool: ToolId;
  color: string;
  size: SizeKey;
  canMark: boolean;
  activeId: string | null;
  selection: Span | null;
  onSelection: (span: Span | null) => void;
  onDraw: (shape: Shape, time: number) => void;
  onHover: (id: string | null) => void;
  onPick: (id: string) => void;
  /** Called with the playhead position whenever the video settles (paused/seeked). */
  onSettle: (time: number) => void;
};

const SHORTCUTS: Array<[string, string]> = [
  ["Space", "Play / pause"],
  ["← →", "Step one frame"],
  ["Shift + ← →", "Jump 5 seconds"],
  ["I  /  O", "Set portion start / end"],
  ["Esc", "Clear portion or markup"],
  ["Enter", "Write a comment"],
  ["V C D H R E A", "Choose a tool"],
  ["F", "Fullscreen"],
];

export function VideoStage(p: Props) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const clock = useVideoClock(video);
  const scrubbing = useRef(false);
  const resume = useRef(false);
  const limit = useRef<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [helpAnchor, setHelpAnchor] = useState<HTMLButtonElement | null>(null);
  const [help, setHelp] = useState(false);
  const canFullscreen = typeof document !== "undefined" && document.fullscreenEnabled;

  const setRef = useCallback(
    (el: HTMLVideoElement | null) => {
      p.videoRef.current = el;
      setVideo(el);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.videoRef],
  );

  // Always a precise seek: fastSeek() snaps to keyframes, which would make a
  // comment's timestamp land somewhere the reviewer never pointed.
  const seek = useCallback(
    (t: number) => {
      if (video) video.currentTime = clamp(t, 0, video.duration || 0);
    },
    [video],
  );
  const toggle = useCallback(() => {
    if (!video) return;
    limit.current = null;
    if (video.paused || video.ended) void video.play().catch(() => undefined);
    else video.pause();
  }, [video]);

  // Stop at the end of a "play portion" run.
  useEffect(() => {
    if (limit.current !== null && clock.playing && clock.time >= limit.current) {
      limit.current = null;
      video?.pause();
    }
  }, [clock.time, clock.playing, video]);

  // Report where the video rests so the comment box can say "At 0:12".
  const { onSettle } = p;
  useEffect(() => {
    if (!clock.playing && !clock.waiting) onSettle(clock.time);
  }, [clock.playing, clock.waiting, clock.time, onSettle]);

  // Drawing needs a still frame.
  useEffect(() => {
    if (p.tool !== "hand") video?.pause();
  }, [p.tool, video]);

  useEffect(() => {
    const on = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void p.stageRef.current?.requestFullscreen?.().catch(() => undefined);
  }, [p.stageRef]);

  const beginPortion = useCallback(() => {
    if (!clock.duration) return;
    const length = Math.min(3, clock.duration);
    const start = clamp(clock.time, 0, clock.duration - length);
    p.onSelection({ start, end: start + length });
  }, [clock.duration, clock.time, p]);

  const playPortion = useCallback(() => {
    if (!video || !p.selection) return;
    video.currentTime = p.selection.start;
    limit.current = p.selection.end;
    void video.play().catch(() => undefined);
  }, [video, p.selection]);

  const step = useCallback(
    (frames: number) => {
      if (!video) return;
      video.pause();
      seek(video.currentTime + frames * FRAME);
    },
    [video, seek],
  );

  useWindowKey((e) => {
    if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === " " && keyboardOwnsControl(e.target)) return;
    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault();
        toggle();
        break;
      case "ArrowLeft":
        e.preventDefault();
        e.shiftKey ? seek((video?.currentTime ?? 0) - 5) : step(-1);
        break;
      case "ArrowRight":
        e.preventDefault();
        e.shiftKey ? seek((video?.currentTime ?? 0) + 5) : step(1);
        break;
      case "i":
      case "I": {
        const end = p.selection?.end ?? Math.min(clock.duration, clock.time + 3);
        p.onSelection({ start: clock.time, end: Math.max(end, clock.time + MIN_PORTION) });
        break;
      }
      case "o":
      case "O": {
        const start = p.selection?.start ?? Math.max(0, clock.time - 3);
        p.onSelection({ start: Math.max(0, Math.min(start, clock.time - MIN_PORTION)), end: Math.max(clock.time, MIN_PORTION) });
        break;
      }
      case "f":
      case "F":
        if (canFullscreen) toggleFullscreen();
        break;
      case "m":
      case "M":
        if (video) video.muted = !video.muted;
        break;
    }
  });

  // Marks that are on screen at the playhead.
  const marks: Marked[] = useMemo(
    () =>
      p.placed
        .filter((c) => c.span && c.shapes.length && isActiveAt(c.span, clock.time))
        .map((c) => ({ id: c.row.id, n: c.n, shapes: c.shapes, color: c.color, anchor: c.anchor })),
    [p.placed, clock.time],
  );
  // Pending markup shows on the frame it was drawn on, and throughout a selected
  // portion (where it will play back once posted) — so you never lose sight of
  // your own stroke, even if a portion is selected elsewhere on the timeline.
  const draftVisible = useMemo(() => {
    if (!p.draft.length) return [];
    const inPortion = !!p.selection && clock.time >= p.selection.start - 0.05 && clock.time <= p.selection.end + 0.05;
    const onDrawnFrame = p.draftTime !== null && Math.abs(clock.time - p.draftTime) <= 0.4;
    return inPortion || onDrawnFrame ? p.draft : [];
  }, [p.draft, p.draftTime, p.selection, clock.time]);

  const markers: TimelineMarker[] = useMemo(
    () => p.placed.filter((c) => c.span && c.n).map((c) => ({ id: c.row.id, n: c.n, span: c.span!, color: c.color })),
    [p.placed],
  );

  const bigPlay = !clock.playing && p.tool === "hand" && (clock.time < 0.05 || clock.ended) && !clock.failed;

  return (
    <>
      <Annotator
        media={clock.size}
        tool={p.tool}
        color={p.color}
        size={p.size}
        marks={marks}
        draft={draftVisible}
        draftNumber={p.draftNumber}
        activeId={p.activeId}
        interactive={p.canMark}
        zoomable={false}
        onStart={() => video?.pause()}
        onDraw={(shape) => {
          video?.pause();
          p.onDraw(shape, video?.currentTime ?? clock.time);
        }}
        onHover={p.onHover}
        onPick={p.onPick}
        onBackgroundTap={toggle}
        overlay={
          <>
            {bigPlay && (
              <button type="button" className="big-play" aria-label="Play video" onClick={toggle}>
                <Play size={30} fill="currentColor" />
              </button>
            )}
            {clock.waiting && !clock.failed && <span className="media-spinner" role="status" aria-label="Loading video" />}
            {clock.failed && (
              <div className="media-error" role="alert">
                <AlertCircle size={22} />
                <b>This video can’t be played here</b>
                <span>Try another browser, or open the original file.</span>
                <a className="button button-glass small" href={p.src} target="_blank" rel="noreferrer">
                  Open original
                </a>
              </div>
            )}
          </>
        }
      >
        <video
          ref={setRef}
          className="media"
          src={`${p.src}#t=0.001`}
          playsInline
          preload="metadata"
          disablePictureInPicture
        />
      </Annotator>

      <div className="video-bar">
        <Timeline
          clock={clock}
          markers={markers}
          selection={p.selection}
          activeId={p.activeId}
          onSeek={seek}
          onSelection={p.onSelection}
          onMarker={p.onPick}
          onScrub={(on) => {
            scrubbing.current = on;
            if (on) {
              resume.current = !!video && !video.paused;
              video?.pause();
            } else if (resume.current) {
              resume.current = false;
              void video?.play().catch(() => undefined);
            }
          }}
        />

        <div className="transport">
          <div className="transport-group">
            <button type="button" className="tbtn is-play" aria-label={clock.playing ? "Pause" : "Play"} onClick={toggle}>
              {clock.playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
            </button>
            <button type="button" className="tbtn hide-sm" aria-label="Back one frame" data-tip="Back a frame · ←" onClick={() => step(-1)}>
              <ChevronLeft size={18} />
            </button>
            <button type="button" className="tbtn hide-sm" aria-label="Forward one frame" data-tip="Forward a frame · →" onClick={() => step(1)}>
              <ChevronRight size={18} />
            </button>
            <span className="clock tabular" aria-live="off">
              {formatTime(clock.time, true)} <i>/ {formatTime(clock.duration)}</i>
            </span>
          </div>

          <div className="transport-group is-right">
            {p.selection ? (
              <div className="portion-chip" role="group" aria-label="Selected portion">
                <SquareDashedMousePointer size={14} />
                <span className="tabular">{formatSpan(p.selection)}</span>
                <button type="button" aria-label="Play this portion" data-tip="Play portion" onClick={playPortion}>
                  <Play size={13} fill="currentColor" />
                </button>
                <button type="button" aria-label="Clear selected portion" data-tip="Clear" onClick={() => p.onSelection(null)}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" className="tbtn has-label" data-tip="Select a portion · I" onClick={beginPortion}>
                <SquareDashedMousePointer size={16} />
                <span className="lbl-long">Select portion</span>
                <span className="lbl-short">Portion</span>
              </button>
            )}
            <button
              type="button"
              className="tbtn has-label rate"
              aria-label={`Playback speed ${clock.rate}×. Change speed`}
              data-tip="Speed"
              onClick={() => {
                if (video) video.playbackRate = RATES[(RATES.indexOf(video.playbackRate) + 1) % RATES.length] ?? 1;
              }}
            >
              <span className="tabular">{clock.rate}×</span>
            </button>
            <button
              type="button"
              className="tbtn"
              aria-label={clock.muted ? "Unmute" : "Mute"}
              data-tip={clock.muted ? "Unmute · M" : "Mute · M"}
              onClick={() => video && (video.muted = !video.muted)}
            >
              {clock.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button ref={setHelpAnchor} type="button" className="tbtn hide-touch" aria-label="Keyboard shortcuts" data-tip="Shortcuts" onClick={() => setHelp((v) => !v)}>
              <Keyboard size={18} />
            </button>
            {canFullscreen && (
              <button type="button" className="tbtn" aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} data-tip="Fullscreen · F" onClick={toggleFullscreen}>
                {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            )}
          </div>
        </div>
      </div>

      <Popover anchor={helpAnchor} open={help} onClose={() => setHelp(false)} side="top" align="end" className="shortcuts" label="Keyboard shortcuts">
        <p className="pop-label">Keyboard shortcuts</p>
        <dl>
          {SHORTCUTS.map(([keys, what]) => (
            <div key={keys}>
              <dt>{keys}</dt>
              <dd>{what}</dd>
            </div>
          ))}
        </dl>
      </Popover>
    </>
  );
}
