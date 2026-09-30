import type { Span } from "./annotations";

/** How long a single-moment comment's markup stays on screen after its timestamp. */
export const MOMENT_HOLD = 1.2;
/** Smallest portion a reviewer can select, in seconds. */
export const MIN_PORTION = 0.2;

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** "0:05", "1:02:03", or with tenths ("0:05.3") when `precise`. */
export function formatTime(seconds: number, precise = false) {
  const total = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const whole = Math.floor(total);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const tenth = Math.min(9, Math.floor((total - whole) * 10));
  const base = h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  return precise ? `${base}.${tenth}` : base;
}

export const formatSpan = (span: Span, precise = false) =>
  span.end - span.start < 0.05
    ? formatTime(span.start, precise)
    : `${formatTime(span.start, precise)} – ${formatTime(span.end, precise)}`;

/** "5s", "1m 05s" */
export function formatLength(seconds: number) {
  const s = Math.round(seconds * 10) / 10;
  if (s < 60) return `${Number.isInteger(s) ? s : s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, "0")}s`;
}

/** Does a comment's time window touch the selected portion? */
export function overlapsPortion(span: Span, portion: Span, pad = 0.05) {
  return span.start <= portion.end + pad && span.end >= portion.start - pad;
}

/** Is a comment's markup showing at playhead `t`? */
export function isActiveAt(span: Span, t: number) {
  if (span.end - span.start < 0.05) return t >= span.start - 0.1 && t <= span.start + MOMENT_HOLD;
  return t >= span.start - 0.05 && t <= span.end + 0.05;
}

/**
 * Greedy lane assignment so timeline markers never sit on top of each other.
 * Returns each item's lane index (same order as the input) and the lane count.
 */
export function assignLanes(spans: Span[], duration: number, trackPx: number, minPx = 24, gap = 3) {
  if (!duration || !trackPx) return { lanes: spans.map(() => 0), count: 1 };
  const perSec = trackPx / duration;
  const order = spans.map((_, i) => i).sort((a, b) => spans[a].start - spans[b].start);
  const laneEnd: number[] = [];
  const lanes = new Array<number>(spans.length).fill(0);
  for (const i of order) {
    const x0 = spans[i].start * perSec;
    const x1 = Math.max(spans[i].end * perSec, x0 + minPx);
    let lane = laneEnd.findIndex((end) => end + gap <= x0);
    if (lane === -1) lane = laneEnd.length < 3 ? laneEnd.length : 2;
    laneEnd[lane] = Math.max(laneEnd[lane] ?? 0, x1);
    lanes[i] = lane;
  }
  return { lanes, count: Math.max(1, laneEnd.length) };
}
