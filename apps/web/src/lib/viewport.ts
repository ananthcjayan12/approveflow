/**
 * Zoom / pan maths for the image stage.
 *
 * The media is centred in its container and drawn at "fit" size. A view is a
 * scale `z` plus a translation (x, y) in container pixels, measured from the
 * centred position. Translation is clamped so the picture can never be flung
 * out of reach.
 */

export type View = { z: number; x: number; y: number };
export const FIT: View = { z: 1, x: 0, y: 0 };
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

/** Largest size that fits a media of (mw x mh) inside (cw x ch) with padding. */
export function containFit(cw: number, ch: number, mw: number, mh: number, pad = 0) {
  const availW = Math.max(1, cw - pad * 2);
  const availH = Math.max(1, ch - pad * 2);
  if (mw <= 0 || mh <= 0) return { w: availW, h: availH };
  const scale = Math.min(availW / mw, availH / mh);
  return { w: Math.max(1, Math.floor(mw * scale)), h: Math.max(1, Math.floor(mh * scale)) };
}

export function clampView(view: View, cw: number, ch: number, w: number, h: number, slack = 48): View {
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, view.z));
  const limitX = Math.max(0, (w * z - cw) / 2 + slack);
  const limitY = Math.max(0, (h * z - ch) / 2 + slack);
  // Smaller than the container on an axis: keep it centred on that axis.
  const x = w * z <= cw ? 0 : Math.min(limitX, Math.max(-limitX, view.x));
  const y = h * z <= ch ? 0 : Math.min(limitY, Math.max(-limitY, view.y));
  return { z, x, y };
}

/**
 * Zoom to `next`, keeping the content point under (px, py) — given relative to
 * the container centre — where it is on screen.
 */
export function zoomAt(view: View, next: number, px: number, py: number, cw: number, ch: number, w: number, h: number): View {
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
  const ratio = z / view.z;
  return clampView({ z, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio }, cw, ch, w, h);
}

export const panBy = (view: View, dx: number, dy: number, cw: number, ch: number, w: number, h: number): View =>
  clampView({ ...view, x: view.x + dx, y: view.y + dy }, cw, ch, w, h);
