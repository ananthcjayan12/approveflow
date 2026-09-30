/**
 * Review markup model.
 *
 * Every coordinate is normalised to 0..1 of the media frame, so markup lines up
 * at any screen size and zoom level. Stroke sizes are stored in per-mille of the
 * media width for the same reason. The Worker validates the same shapes.
 */

export type Pt = [number, number];

export type ToolId = "hand" | "pin" | "pen" | "highlight" | "rect" | "ellipse" | "arrow";

type Style = { c: string; s: number };
export type Shape =
  | (Style & { t: "pin"; p: Pt })
  | (Style & { t: "rect"; a: Pt; b: Pt })
  | (Style & { t: "ellipse"; a: Pt; b: Pt })
  | (Style & { t: "arrow"; a: Pt; b: Pt })
  | (Style & { t: "pen"; pts: Pt[] })
  | (Style & { t: "highlight"; pts: Pt[] });

export type ShapeKind = Shape["t"];

export const BRAND = "#5b5bd6";

export const PALETTE = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#facc15" },
  { name: "Green", value: "#22c55e" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Indigo", value: BRAND },
  { name: "Pink", value: "#ec4899" },
  { name: "White", value: "#ffffff" },
  { name: "Black", value: "#111827" },
] as const;

/** Stroke sizes in per-mille of the media width. */
export const SIZES = { S: 3.5, M: 6, L: 10 } as const;
export type SizeKey = keyof typeof SIZES;

export const DEFAULT_COLORS: Record<Exclude<ToolId, "hand">, string> = {
  pin: BRAND,
  pen: "#ef4444",
  highlight: "#facc15",
  rect: "#ef4444",
  ellipse: "#ef4444",
  arrow: "#ef4444",
};

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const q4 = (n: number) => Math.round(n * 10000) / 10000;
export const norm = (p: Pt): Pt => [q4(clamp01(p[0])), q4(clamp01(p[1]))];

/** Rendered stroke width in pixels for a shape on a frame `width` px wide. */
export function strokePx(shape: Shape, width: number) {
  const base = (shape.s / 1000) * width;
  return shape.t === "highlight" ? Math.max(14, base * 3.2) : Math.max(2, base);
}

// ---- Geometry ---------------------------------------------------------------

function distanceToSegment(p: Pt, a: Pt, b: Pt) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Ramer–Douglas–Peucker (iterative, so long strokes cannot overflow the stack). */
export function simplify(points: Pt[], tolerance = 0.0012): Pt[] {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop()!;
    let far = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = distanceToSegment(points[i], points[start], points[end]);
      if (d > far) {
        far = d;
        index = i;
      }
    }
    if (index !== -1 && far > tolerance) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

export function shapePoints(shape: Shape): Pt[] {
  if (shape.t === "pin") return [shape.p];
  if (shape.t === "pen" || shape.t === "highlight") return shape.pts;
  return [shape.a, shape.b];
}

export function boundsOf(shapes: Shape[]) {
  const pts = shapes.flatMap(shapePoints);
  if (!pts.length) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Where a shape's numbered badge sits. */
export function anchorOf(shape: Shape): Pt {
  switch (shape.t) {
    case "pin":
      return shape.p;
    case "rect":
    case "ellipse":
      return [Math.min(shape.a[0], shape.b[0]), Math.min(shape.a[1], shape.b[1])];
    case "arrow":
      return shape.a;
    default:
      return shape.pts[0];
  }
}

/** A comment's badge: its pin if it has one, otherwise the first shape's anchor. */
export function commentAnchor(shapes: Shape[]): Pt | null {
  const pin = shapes.find((s) => s.t === "pin");
  const first = pin ?? shapes[0];
  return first ? anchorOf(first) : null;
}

export function kindOfShapes(shapes: Shape[]): "point" | "rectangle" | "drawing" {
  if (shapes.length === 1 && shapes[0].t === "pin") return "point";
  if (shapes.length === 1 && shapes[0].t === "rect") return "rectangle";
  return "drawing";
}

const LABELS: Record<ShapeKind, [string, string]> = {
  pin: ["Pin", "Pins"],
  rect: ["Box", "Boxes"],
  ellipse: ["Circle", "Circles"],
  arrow: ["Arrow", "Arrows"],
  pen: ["Drawing", "Drawings"],
  highlight: ["Highlight", "Highlights"],
};

/** "Pin", "2 drawings + Arrow" — a short human description of the markup. */
export function describeShapes(shapes: Shape[]) {
  const counts = new Map<ShapeKind, number>();
  for (const s of shapes) counts.set(s.t, (counts.get(s.t) ?? 0) + 1);
  return [...counts.entries()]
    .map(([t, n]) => (n === 1 ? LABELS[t][0] : `${n} ${LABELS[t][1].toLowerCase()}`))
    .join(" + ");
}

// ---- Rendering helpers ------------------------------------------------------

/** Smooth freehand path (quadratic curves through segment midpoints). */
export function smoothPath(pts: Pt[], w: number, h: number) {
  if (!pts.length) return "";
  const P = pts.map(([x, y]) => [x * w, y * h] as const);
  const f = (n: number) => n.toFixed(1);
  if (P.length === 1) return `M${f(P[0][0])},${f(P[0][1])}h0.01`;
  let d = `M${f(P[0][0])},${f(P[0][1])}`;
  if (P.length === 2) return `${d}L${f(P[1][0])},${f(P[1][1])}`;
  for (let i = 1; i < P.length - 1; i++) {
    const mx = (P[i][0] + P[i + 1][0]) / 2;
    const my = (P[i][1] + P[i + 1][1]) / 2;
    d += `Q${f(P[i][0])},${f(P[i][1])} ${f(mx)},${f(my)}`;
  }
  const last = P[P.length - 1];
  return `${d}L${f(last[0])},${f(last[1])}`;
}

/** Arrow as a shaft plus a filled head, in pixel space. */
export function arrowGeometry(a: Pt, b: Pt, w: number, h: number, stroke: number) {
  const ax = a[0] * w;
  const ay = a[1] * h;
  const bx = b[0] * w;
  const by = b[1] * h;
  const angle = Math.atan2(by - ay, bx - ax);
  const length = Math.hypot(bx - ax, by - ay);
  const head = Math.min(length * 0.6, Math.max(14, Math.min(44, stroke * 4.5)));
  const wing = (Math.PI / 180) * 27;
  const left = [bx - head * Math.cos(angle - wing), by - head * Math.sin(angle - wing)];
  const right = [bx - head * Math.cos(angle + wing), by - head * Math.sin(angle + wing)];
  const shaftEnd = [bx - head * 0.55 * Math.cos(angle), by - head * 0.55 * Math.sin(angle)];
  const f = (n: number) => n.toFixed(1);
  return {
    shaft: `M${f(ax)},${f(ay)}L${f(shaftEnd[0])},${f(shaftEnd[1])}`,
    head: `M${f(bx)},${f(by)}L${f(left[0])},${f(left[1])}L${f(right[0])},${f(right[1])}Z`,
  };
}

export function boxGeometry(a: Pt, b: Pt, w: number, h: number) {
  const x = Math.min(a[0], b[0]) * w;
  const y = Math.min(a[1], b[1]) * h;
  return { x, y, width: Math.abs(a[0] - b[0]) * w, height: Math.abs(a[1] - b[1]) * h };
}

// ---- Persistence ------------------------------------------------------------

const isPt = (v: unknown): v is Pt =>
  Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1);

function isShape(v: any): v is Shape {
  if (!v || typeof v !== "object") return false;
  if (typeof v.c !== "string" || !/^#[0-9a-f]{6}$/i.test(v.c)) return false;
  if (typeof v.s !== "number" || !(v.s >= 1 && v.s <= 40)) return false;
  switch (v.t) {
    case "pin":
      return isPt(v.p);
    case "rect":
    case "ellipse":
    case "arrow":
      return isPt(v.a) && isPt(v.b);
    case "pen":
    case "highlight":
      return Array.isArray(v.pts) && v.pts.length >= 2 && v.pts.every(isPt);
    default:
      return false;
  }
}

/** Parses the Worker's `shape_json`; anything malformed is dropped, never thrown. */
export function parseMarkup(json: string | null | undefined): Shape[] {
  if (!json) return [];
  try {
    const data = JSON.parse(json);
    return Array.isArray(data?.shapes) ? data.shapes.filter(isShape) : [];
  } catch {
    return [];
  }
}

/** Shapes ready for the API: quantised, and freehand strokes simplified. */
export function toApiShapes(shapes: Shape[]): Shape[] {
  return shapes.map((shape): Shape => {
    switch (shape.t) {
      case "pin":
        return { ...shape, p: norm(shape.p) };
      case "rect":
      case "ellipse":
      case "arrow":
        return { ...shape, a: norm(shape.a), b: norm(shape.b) };
      default: {
        let pts = simplify(shape.pts).map(norm);
        // The Worker accepts up to 600 points; thin out pathological strokes.
        if (pts.length > 500) {
          const step = Math.ceil(pts.length / 500);
          pts = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
        }
        if (pts.length < 2) pts = [pts[0], pts[0]];
        return { ...shape, pts };
      }
    }
  });
}

// ---- Building the API payload -----------------------------------------------

export type AnnotationPayload = {
  kind: "point" | "rectangle" | "drawing" | "video_timestamp" | "video_range";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  timestampMs?: number;
  startMs?: number;
  endMs?: number;
  shapes?: Shape[];
};

/**
 * What a new comment is attached to. Images attach their markup; videos attach
 * a moment or a portion (with optional markup drawn on that frame). Returns
 * undefined for a plain, unanchored comment.
 */
export function buildAnnotation(o: {
  isVideo: boolean;
  shapes: Shape[];
  /** Playhead position in seconds when the reviewer started marking up. */
  markedAt: number | null;
  /** Where the playhead rests now, in seconds. */
  now: number;
  portion: Span | null;
  /** Whether the reviewer wants the comment pinned to the current moment. */
  timestamped: boolean;
}): AnnotationPayload | undefined {
  const shapes = o.shapes.length ? toApiShapes(o.shapes) : undefined;
  const geometry = shapes ? { ...boundsOf(shapes), shapes } : {};
  if (o.isVideo) {
    if (o.portion)
      return {
        kind: "video_range",
        startMs: Math.round(o.portion.start * 1000),
        endMs: Math.round(o.portion.end * 1000),
        ...geometry,
      };
    // Markup always belongs to a frame, so it implies a moment.
    if (o.timestamped || shapes) return { kind: "video_timestamp", timestampMs: Math.round((o.markedAt ?? o.now) * 1000), ...geometry };
    return undefined;
  }
  return shapes ? { kind: kindOfShapes(shapes), ...geometry } : undefined;
}

// ---- Comments <-> markup ------------------------------------------------------

export type CommentGeometry = {
  id: string;
  kind?: string | null;
  x: number | null;
  y: number | null;
  timestamp_ms: number | null;
  start_ms: number | null;
  end_ms: number | null;
  shape_json?: string | null;
};

export type Span = { start: number; end: number };

export type PlacedComment<T extends CommentGeometry = CommentGeometry> = {
  row: T;
  /** Display number shared by the list, the on-media badge and the timeline. */
  n: number | null;
  shapes: Shape[];
  /** Time window in seconds for video comments (a moment has start === end). */
  span: Span | null;
  color: string;
  anchor: Pt | null;
};

export function spanOf(row: Pick<CommentGeometry, "timestamp_ms" | "start_ms" | "end_ms">): Span | null {
  if (row.start_ms !== null && row.start_ms !== undefined) {
    const start = row.start_ms / 1000;
    const end = row.end_ms !== null && row.end_ms !== undefined ? row.end_ms / 1000 : start;
    return { start, end: Math.max(start, end) };
  }
  if (row.timestamp_ms !== null && row.timestamp_ms !== undefined) {
    const at = row.timestamp_ms / 1000;
    return { start: at, end: at };
  }
  return null;
}

/** Comments made with the original pin-only UI have x/y but no shape JSON. */
function shapesFor(row: CommentGeometry): Shape[] {
  const parsed = parseMarkup(row.shape_json);
  if (parsed.length) return parsed;
  const legacyPin = row.x !== null && row.y !== null && row.x !== undefined && row.y !== undefined;
  const isVideoMoment = row.kind === "video_timestamp" || row.kind === "video_range";
  if (legacyPin && !isVideoMoment && isPt([row.x, row.y])) return [{ t: "pin", p: [row.x!, row.y!], c: BRAND, s: 6 }];
  return [];
}

export function placeComments<T extends CommentGeometry>(rows: T[]): PlacedComment<T>[] {
  let n = 0;
  return rows.map((row) => {
    const shapes = shapesFor(row);
    const span = spanOf(row);
    const anchored = shapes.length > 0 || span !== null;
    return {
      row,
      n: anchored ? ++n : null,
      shapes,
      span,
      color: shapes[0]?.c ?? BRAND,
      anchor: commentAnchor(shapes),
    };
  });
}
