import { useLayoutEffect, useState, type RefObject } from "react";
import { PostArt } from "./art";
import { waypointAt, type Waypoint } from "./script";

type Point = { x: number; y: number };

/**
 * Follows a list of waypoints. Each waypoint names an element (`data-cur`) inside
 * `root`; the pointer is positioned on it in the root's own, unscaled pixels, so
 * the tour keeps working whatever size the stage is drawn at.
 */
export function usePointer(root: RefObject<HTMLElement | null>, list: Waypoint[], t: number, scale: number, park: Point) {
  const i = waypointAt(list, t);
  const w = i >= 0 ? list[i] : undefined;
  const [pos, setPos] = useState<Point>(park);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || !w?.to) return;
    const target = el.querySelector<HTMLElement>(`[data-cur="${w.to}"]`);
    if (!target) return;
    const r = target.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    setPos({ x: (r.left + r.width / 2 - b.left) / scale, y: (r.top + r.height / 2 - b.top) / scale });
  }, [i, scale, root, w?.to]);

  const dur = w?.dur ?? 0;
  const arrive = (w?.t ?? 0) + dur;
  const clicking = !!w?.click && t >= arrive && t < arrive + 180;
  return {
    pos,
    dur,
    visible: !!w?.to,
    down: clicking || (!!w?.down && t < arrive + 80),
    ripple: w?.click && t >= arrive && t < arrive + 700 ? i : -1,
  };
}

export type PointerState = ReturnType<typeof usePointer>;

/** A mouse cursor (laptop) or a fingertip (phone). */
export function Pointer({ kind, state, carrying = false }: { kind: "mouse" | "finger"; state: PointerState; carrying?: boolean }) {
  const { pos, dur, visible, down, ripple } = state;
  return (
    <div
      className={`tv-pointer is-${kind}${visible ? " is-on" : ""}${down ? " is-down" : ""}`}
      style={{ transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`, transitionDuration: `${dur}ms, 200ms` }}
      aria-hidden
    >
      {ripple >= 0 && <i key={ripple} className="tv-ripple" />}
      {kind === "mouse" ? (
        <svg className="tv-arrow" width="22" height="26" viewBox="0 0 22 26">
          <path d="M3 2v19l5.2-4.6 3.3 7.3 3.4-1.5-3.2-7.1H19z" fill="#fff" stroke="#0d1220" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      ) : (
        <i className="tv-tip" />
      )}
      {carrying && (
        <span className="tv-carry">
          <b>
            <PostArt />
          </b>
          <b />
          <b />
        </span>
      )}
    </div>
  );
}
