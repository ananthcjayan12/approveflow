import { PointerEvent as ReactPointerEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import {
  Pt,
  SIZES,
  Shape,
  SizeKey,
  ToolId,
  arrowGeometry,
  boxGeometry,
  clamp01,
  smoothPath,
  strokePx,
} from "../../lib/annotations";
import { readableOn } from "../../lib/color";
import { isTyping, keyboardOwnsControl, useElementSize, useMediaQuery, useWindowKey } from "../../lib/hooks";
import { FIT, MAX_ZOOM, View, clampView, containFit, panBy, zoomAt } from "../../lib/viewport";

/** A posted comment's markup, ready to draw. */
export type Marked = {
  id: string;
  n: number | null;
  shapes: Shape[];
  color: string;
  anchor: Pt | null;
};

type Props = {
  /** Natural size of the media, once known. */
  media: { w: number; h: number } | null;
  tool: ToolId;
  color: string;
  size: SizeKey;
  marks: Marked[];
  draft: Shape[];
  /** Number the pending comment will get. */
  draftNumber: number;
  activeId: string | null;
  /** When false the reviewer can only look, pan and zoom. */
  interactive: boolean;
  zoomable: boolean;
  onDraw: (shape: Shape) => void;
  /** Fires the moment a draw gesture begins (video uses it to freeze the frame). */
  onStart?: () => void;
  onHover: (id: string | null) => void;
  onPick: (id: string) => void;
  /** A tap on empty canvas with the hand tool (the video uses it for play/pause). */
  onBackgroundTap?: () => void;
  children: ReactNode;
  overlay?: ReactNode;
};

type Gesture =
  | { kind: "draw"; id: number; shape: Shape; sx: number; sy: number }
  | { kind: "tap"; id: number; sx: number; sy: number; moved: boolean }
  | { kind: "pan"; id: number; sx: number; sy: number; lx: number; ly: number; moved: boolean }
  | { kind: "pinch"; d0: number; view0: View; mid0: { x: number; y: number } };

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(" ");

export function ShapeSvg({ shape, w, h }: { shape: Shape; w: number; h: number }) {
  const sw = strokePx(shape, w);
  switch (shape.t) {
    case "pen":
      return <path d={smoothPath(shape.pts, w, h)} stroke={shape.c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
    case "highlight":
      return (
        <path
          className="hl"
          d={smoothPath(shape.pts, w, h)}
          stroke={shape.c}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "rect": {
      const b = boxGeometry(shape.a, shape.b, w, h);
      return <rect {...b} rx={Math.min(8, b.width / 4, b.height / 4)} stroke={shape.c} strokeWidth={sw} fill={shape.c} fillOpacity={0.09} strokeLinejoin="round" />;
    }
    case "ellipse": {
      const b = boxGeometry(shape.a, shape.b, w, h);
      return (
        <ellipse cx={b.x + b.width / 2} cy={b.y + b.height / 2} rx={b.width / 2} ry={b.height / 2} stroke={shape.c} strokeWidth={sw} fill={shape.c} fillOpacity={0.09} />
      );
    }
    case "arrow": {
      const g = arrowGeometry(shape.a, shape.b, w, h, sw);
      return (
        <g stroke={shape.c} fill={shape.c} strokeLinecap="round" strokeLinejoin="round">
          <path d={g.shaft} strokeWidth={sw} fill="none" />
          <path d={g.head} strokeWidth={sw * 0.5} />
        </g>
      );
    }
    default:
      return null; // pins are drawn as badges
  }
}

function Badge({
  at,
  n,
  color,
  pin,
  active,
  dim,
  pending,
  label,
  onClick,
  onEnter,
  onLeave,
}: {
  at: Pt;
  n: number | null;
  color: string;
  pin: boolean;
  active?: boolean;
  dim?: boolean;
  pending?: boolean;
  label: string;
  onClick?: () => void;
  onEnter?: () => void;
  onLeave?: () => void;
}) {
  return (
    <div className="anchor" style={{ left: `${at[0] * 100}%`, top: `${at[1] * 100}%` }}>
      <button
        type="button"
        tabIndex={pending ? -1 : 0}
        aria-label={label}
        className={cx("mark-badge", pin ? "is-pin" : "is-dot", active && "is-active", dim && "is-dim", pending && "is-pending")}
        style={{ ["--c" as string]: color, ["--on" as string]: readableOn(color) }}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onPointerEnter={(e) => e.pointerType === "mouse" && onEnter?.()}
        onPointerLeave={(e) => e.pointerType === "mouse" && onLeave?.()}
        onFocus={onEnter}
        onBlur={onLeave}
      >
        <span>{n ?? ""}</span>
      </button>
    </div>
  );
}

export function Annotator(p: Props) {
  const [setBox, box, boxNode] = useElementSize<HTMLDivElement>();
  const frameRef = useRef<HTMLDivElement>(null);
  const compact = useMediaQuery("(max-width: 640px)");
  const pad = compact ? 8 : 24;
  const fit = useMemo(
    () => containFit(box.w, box.h, p.media?.w ?? 16, p.media?.h ?? 9, pad),
    [box.w, box.h, p.media?.w, p.media?.h, pad],
  );
  const [view, setView] = useState<View>(FIT);
  const [live, setLive] = useState<Shape | null>(null);
  const [panning, setPanning] = useState(false);

  // Latest geometry for native listeners and gesture maths.
  const geo = useRef({ box, fit, view });
  geo.current = { box, fit, view };
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<Gesture | null>(null);
  const space = useRef(false);

  useEffect(() => {
    setView((v) => clampView(v, box.w, box.h, fit.w, fit.h));
  }, [box.w, box.h, fit.w, fit.h]);

  const centre = () => {
    const r = boxNode?.getBoundingClientRect();
    return { x: (r?.left ?? 0) + (r?.width ?? 0) / 2, y: (r?.top ?? 0) + (r?.height ?? 0) / 2 };
  };
  const toNorm = (clientX: number, clientY: number): Pt => {
    const r = frameRef.current!.getBoundingClientRect();
    return [clamp01((clientX - r.left) / r.width), clamp01((clientY - r.top) / r.height)];
  };
  const zoomTo = (next: number, px = 0, py = 0) => {
    const { box: b, fit: f } = geo.current;
    setView((v) => zoomAt(v, next, px, py, b.w, b.h, f.w, f.h));
  };

  // Wheel / trackpad pinch (native listener: React's wheel handler is passive).
  useEffect(() => {
    if (!boxNode || !p.zoomable) return;
    const on = (e: WheelEvent) => {
      const { box: b, fit: f, view: v } = geo.current;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const c = centre();
        const delta = Math.max(-30, Math.min(30, e.deltaY));
        setView((cur) => zoomAt(cur, cur.z * Math.exp(-delta * 0.012), e.clientX - c.x, e.clientY - c.y, b.w, b.h, f.w, f.h));
      } else if (v.z > 1) {
        e.preventDefault();
        setView((cur) => panBy(cur, -e.deltaX, -e.deltaY, b.w, b.h, f.w, f.h));
      }
    };
    boxNode.addEventListener("wheel", on, { passive: false });
    return () => boxNode.removeEventListener("wheel", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxNode, p.zoomable]);

  // Zoom shortcuts and hold-space-to-pan.
  useWindowKey((e) => {
    if (!p.zoomable || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "+" || e.key === "=") zoomTo(geo.current.view.z * 1.4);
    else if (e.key === "-" || e.key === "_") zoomTo(geo.current.view.z / 1.4);
    else if (e.key === "0") setView(FIT);
    else if (e.key === " " && !keyboardOwnsControl(e.target)) {
      // Hold space to drag the picture; never steal it from a focused control.
      e.preventDefault();
      space.current = true;
    }
  }, p.zoomable);
  useEffect(() => {
    const up = (e: KeyboardEvent) => e.key === " " && (space.current = false);
    window.addEventListener("keyup", up);
    return () => window.removeEventListener("keyup", up);
  }, []);

  const style = () => ({ c: p.color, s: SIZES[p.size] });

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, [e.clientX, e.clientY]);

    // A second finger turns whatever was happening into a pinch.
    if (pointers.current.size === 2 && p.zoomable) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        kind: "pinch",
        d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1,
        view0: geo.current.view,
        mid0: { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 },
      };
      setLive(null);
      return;
    }
    if (pointers.current.size > 1) return;

    const pan = e.button === 1 || space.current || p.tool === "hand" || !p.interactive;
    if (pan) {
      gesture.current = { kind: "pan", id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
      return;
    }
    const pt = toNorm(e.clientX, e.clientY);
    p.onStart?.();
    if (p.tool === "pin") {
      gesture.current = { kind: "tap", id: e.pointerId, sx: e.clientX, sy: e.clientY, moved: false };
    } else if (p.tool === "pen" || p.tool === "highlight") {
      const shape: Shape = { t: p.tool, pts: [pt], ...style() };
      gesture.current = { kind: "draw", id: e.pointerId, shape, sx: e.clientX, sy: e.clientY };
      setLive(shape);
    } else if (p.tool === "rect" || p.tool === "ellipse" || p.tool === "arrow") {
      const shape: Shape = { t: p.tool, a: pt, b: pt, ...style() };
      gesture.current = { kind: "draw", id: e.pointerId, shape, sx: e.clientX, sy: e.clientY };
      setLive(shape);
    }
  };

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
    const g = gesture.current;
    if (!g) return;
    const { box: b, fit: f } = geo.current;

    if (g.kind === "pinch") {
      const [a, c] = [...pointers.current.values()];
      if (!c) return;
      const dist = Math.hypot(a[0] - c[0], a[1] - c[1]);
      const mid = { x: (a[0] + c[0]) / 2, y: (a[1] + c[1]) / 2 };
      const ctr = centre();
      let next = zoomAt(g.view0, g.view0.z * (dist / g.d0), g.mid0.x - ctr.x, g.mid0.y - ctr.y, b.w, b.h, f.w, f.h);
      next = clampView({ ...next, x: next.x + (mid.x - g.mid0.x), y: next.y + (mid.y - g.mid0.y) }, b.w, b.h, f.w, f.h);
      setView(next);
      return;
    }
    if (g.id !== e.pointerId) return;

    if (g.kind === "pan") {
      if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < 5) return;
      const dx = e.clientX - g.lx;
      const dy = e.clientY - g.ly;
      g.moved = true;
      g.lx = e.clientX;
      g.ly = e.clientY;
      if (p.zoomable && geo.current.view.z > 1) {
        setPanning(true);
        setView((v) => panBy(v, dx, dy, b.w, b.h, f.w, f.h));
      }
    } else if (g.kind === "tap") {
      if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 8) g.moved = true;
    } else {
      const shape = g.shape;
      if (shape.t === "pen" || shape.t === "highlight") {
        // Coalesced events keep fast strokes smooth on high-refresh pens.
        const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
        for (const ev of events.length ? events : [e.nativeEvent]) {
          const next = toNorm(ev.clientX, ev.clientY);
          const last = shape.pts[shape.pts.length - 1];
          const rect = frameRef.current!.getBoundingClientRect();
          if (Math.hypot((next[0] - last[0]) * rect.width, (next[1] - last[1]) * rect.height) >= 1.5) shape.pts.push(next);
        }
        setLive({ ...shape, pts: shape.pts.slice() });
      } else if (shape.t !== "pin") {
        shape.b = toNorm(e.clientX, e.clientY);
        setLive({ ...shape });
      }
    }
  };

  const end = (e: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch") {
      if (pointers.current.size < 2) gesture.current = null;
      return;
    }
    if (g.id !== e.pointerId) return;
    gesture.current = null;
    setPanning(false);
    if (cancelled) {
      setLive(null);
      return;
    }
    if (g.kind === "pan") {
      if (!g.moved) p.onBackgroundTap?.();
    } else if (g.kind === "tap") {
      if (!g.moved) p.onDraw({ t: "pin", p: toNorm(e.clientX, e.clientY), ...style() });
    } else {
      const shape = g.shape;
      setLive(null);
      const rect = frameRef.current!.getBoundingClientRect();
      if (shape.t === "pen" || shape.t === "highlight") {
        // A tap with a pen leaves a dot.
        if (shape.pts.length === 1) shape.pts.push([shape.pts[0][0] + 0.0001, shape.pts[0][1]]);
        p.onDraw(shape);
      } else if (shape.t !== "pin") {
        const length = Math.hypot((shape.b[0] - shape.a[0]) * rect.width, (shape.b[1] - shape.a[1]) * rect.height);
        if (length >= 10) p.onDraw(shape);
      }
    }
  };

  const draftAnchor = useMemo(() => {
    const pin = p.draft.find((s) => s.t === "pin");
    const first = pin ?? p.draft[0];
    if (!first) return null;
    switch (first.t) {
      case "pin":
        return first.p;
      case "rect":
      case "ellipse":
        return [Math.min(first.a[0], first.b[0]), Math.min(first.a[1], first.b[1])] as Pt;
      case "arrow":
        return first.a;
      default:
        return first.pts[0];
    }
  }, [p.draft]);

  const dim = (id: string) => !!p.activeId && p.activeId !== id;
  const cursor = p.tool === "hand" || !p.interactive ? (view.z > 1 ? (panning ? "grabbing" : "grab") : "default") : "crosshair";

  return (
    <div className="canvas" ref={setBox}>
      <div
        ref={frameRef}
        className="frame"
        style={{
          width: fit.w,
          height: fit.h,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
          ["--z" as string]: view.z,
        }}
      >
        {p.children}

        <svg className="mk-layer" width={fit.w} height={fit.h} viewBox={`0 0 ${fit.w} ${fit.h}`} aria-hidden>
          {p.marks.map((m) => (
            <g key={m.id} className={cx("mk", p.activeId === m.id && "is-active", dim(m.id) && "is-dim")}>
              {m.shapes.map((s, i) => (
                <ShapeSvg key={i} shape={s} w={fit.w} h={fit.h} />
              ))}
            </g>
          ))}
          {p.draft.length > 0 && (
            <g className="mk mk-draft">
              {p.draft.map((s, i) => (
                <ShapeSvg key={i} shape={s} w={fit.w} h={fit.h} />
              ))}
            </g>
          )}
          {live && (
            <g className="mk mk-live">
              <ShapeSvg shape={live} w={fit.w} h={fit.h} />
            </g>
          )}
        </svg>

        <div
          // Drawing (and pinch/pan) must own the touch, or the browser cancels the
          // gesture the moment it decides a drag is a scroll.
          className={cx("surface", p.zoomable || (p.interactive && p.tool !== "hand") ? "touch-none" : "touch-manipulation")}
          style={{ cursor }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={(e) => end(e)}
          onPointerCancel={(e) => end(e, true)}
          onLostPointerCapture={(e) => pointers.current.delete(e.pointerId)}
        />

        <div className="pin-layer">
          {p.marks.map(
            (m) =>
              m.anchor && (
                <Badge
                  key={m.id}
                  at={m.anchor}
                  n={m.n}
                  color={m.color}
                  pin={m.shapes.some((s) => s.t === "pin")}
                  active={p.activeId === m.id}
                  dim={dim(m.id)}
                  label={`Comment ${m.n}`}
                  onClick={() => p.onPick(m.id)}
                  onEnter={() => p.onHover(m.id)}
                  onLeave={() => p.onHover(null)}
                />
              ),
          )}
          {draftAnchor && (
            <Badge at={draftAnchor} n={p.draftNumber} color={p.draft[0]?.c ?? "#5b5bd6"} pin={p.draft.some((s) => s.t === "pin")} pending label="Your new comment" />
          )}
        </div>
      </div>

      {p.overlay}

      {p.zoomable && (
        <div className={cx("zoom-controls", view.z > 1 && "is-zoomed")} role="group" aria-label="Zoom">
          <button type="button" aria-label="Zoom out" disabled={view.z <= 1} onClick={() => zoomTo(view.z / 1.4)}>
            <Minus size={16} />
          </button>
          <button type="button" className="zoom-level" aria-label="Fit to screen" title="Fit to screen (0)" onClick={() => setView(FIT)}>
            {view.z === 1 ? <Maximize2 size={14} /> : `${Math.round(view.z * 100)}%`}
          </button>
          <button type="button" aria-label="Zoom in" disabled={view.z >= MAX_ZOOM} onClick={() => zoomTo(view.z * 1.4)}>
            <Plus size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
