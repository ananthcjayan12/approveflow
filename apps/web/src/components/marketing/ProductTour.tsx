import { Clock3, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Laptop } from "./tour/Laptop";
import { Phone } from "./tour/Phone";
import { Pointer, usePointer } from "./tour/Pointer";
import { CURSOR, FINGER, frame, LOOP, SCENE_POSTER, SCENES } from "./tour/script";

/**
 * A self-playing demo of the real product: the agency uploads and sends a link,
 * the client marks up the work on their phone, the agency watches it arrive, and
 * the approval lands on the dashboard. Everything on screen is drawn from
 * `frame(t)`, so it can be paused, scrubbed and jumped between scenes.
 */

const DUO = { w: 1140, h: 684 };
const SOLO = { w: 460, h: 660 };
const DUO_MIN = 760;

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** `?tour=12000` freezes the tour at that time while developing. */
function devStart() {
  if (!import.meta.env.DEV) return null;
  const v = new URLSearchParams(location.search).get("tour");
  return v === null ? null : Number(v) || 0;
}

export function ProductTour() {
  const wrap = useRef<HTMLDivElement>(null);
  const laptopRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const frozen = useMemo(devStart, []);

  const [width, setWidth] = useState(DUO.w);
  const [t, setT] = useState(frozen ?? 0);
  const [playing, setPlaying] = useState(frozen === null);
  const [onScreen, setOnScreen] = useState(true);
  const [tabOn, setTabOn] = useState(true);
  const clock = useRef(t);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.12 });
    io.observe(el);
    const vis = () => setTabOn(!document.hidden);
    document.addEventListener("visibilitychange", vis);
    return () => {
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const running = playing && onScreen && tabOn && !reduced;
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let shown = clock.current;
    const step = (now: number) => {
      clock.current = (clock.current + Math.min(now - last, 100)) % LOOP;
      last = now;
      if (Math.abs(clock.current - shown) >= 32 || clock.current < shown) {
        shown = clock.current;
        setT(shown);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const seek = (ms: number) => {
    clock.current = ms;
    setT(ms);
  };

  const f = useMemo(() => frame(reduced ? SCENE_POSTER[frame(t).scene] : t), [t, reduced]);

  const duo = width >= DUO_MIN;
  const design = duo ? DUO : SOLO;
  const scale = duo ? Math.min(1, width / design.w) : Math.min(1.1, width / design.w);
  const focus = t >= 11900 && t < 30700 ? "phone" : "laptop";

  const cursor = usePointer(laptopRef, CURSOR, reduced ? -1 : t, scale, { x: 600, y: 300 });
  const finger = usePointer(phoneRef, FINGER, reduced ? -1 : t, scale, { x: 140, y: 560 });

  const lapStyle = duo ? { left: 0, top: 46 } : { left: 0, top: 10 };
  const phoneStyle = duo ? { left: 840, top: 0 } : { left: 80, top: 10 };

  return (
    <div className={`tour${reduced ? " is-static" : ""}`} ref={wrap}>
      <div className="tour-glow" aria-hidden />
      <div className="tour-stage" style={{ height: design.h * scale }} role="img" aria-label="An animated demo: an agency uploads work and sends one link, the client marks it up on their phone, and the approval appears on the agency’s dashboard.">
        <div className="tour-canvas" style={{ width: design.w, height: design.h, left: Math.max(0, (width - design.w * scale) / 2), transform: `scale(${scale})`, opacity: 1 - f.veil }}>
          <div ref={laptopRef} className={`tv-device tv-laptop-wrap${duo ? "" : " is-compact"}${focus === "laptop" ? " is-focus" : ""}${!duo && focus !== "laptop" ? " is-away" : ""}`} style={{ ...lapStyle, width: duo ? 870 : 460, height: duo ? 600 : 620 }}>
            <Laptop f={f} />
            <Pointer kind="mouse" state={cursor} carrying={f.dragGhost > 0 && f.dragGhost < 1} />
          </div>
          <div ref={phoneRef} className={`tv-device tv-phone${focus === "phone" ? " is-focus" : ""}${!duo && focus !== "phone" ? " is-away" : ""}`} style={phoneStyle}>
            <div className="tv-phone-bezel">
              <span className="notch" />
              <Phone f={f} />
              <Pointer kind="finger" state={finger} />
            </div>
          </div>

          {duo ? (
            <>
              <span className={`tv-tag left${focus === "laptop" ? " on" : ""}`}>Your dashboard</span>
              <span className={`tv-tag right${focus === "phone" ? " on" : ""}`}>Priya’s phone · no login needed</span>
            </>
          ) : (
            <span className="tv-tag mid on">{focus === "phone" ? "Priya’s phone · no login needed" : "Your dashboard"}</span>
          )}

          <div className={`tv-lapse${f.timeLapse ? " in" : ""}`}>
            <Clock3 size={15} /> Next morning · Version 2 is uploaded
          </div>
        </div>
        {!reduced && (
          <button className="tv-ctl" onClick={() => setPlaying((v) => !v)} aria-label={playing ? "Pause the demo" : "Play the demo"}>
            {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          </button>
        )}
      </div>

      <ol className="tv-steps" aria-label="Demo steps">
        {SCENES.map((s, i) => (
          <li key={s.id}>
            <button className={i === f.scene ? "on" : i < f.scene ? "past" : ""} onClick={() => seek(reduced ? SCENE_POSTER[i] : s.at + 60)} aria-current={i === f.scene ? "step" : undefined}>
              <span className="n">{i + 1}</span>
              <b>{s.label}</b>
              <small>{s.title}</small>
              <i className="bar">
                <u style={{ width: `${i < f.scene ? 100 : i === f.scene ? f.sceneProgress * 100 : 0}%` }} />
              </i>
            </button>
          </li>
        ))}
      </ol>
      <p className="tv-caption" aria-live="off">
        {SCENES[f.scene].body}
      </p>
    </div>
  );
}
