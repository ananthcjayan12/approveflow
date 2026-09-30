import {
  AlertCircle,
  BatteryFull,
  Check,
  Clock3,
  Hand,
  Highlighter,
  MapPin,
  MessageSquare,
  MessageSquareText,
  MoveUpRight,
  PartyPopper,
  Pause,
  Pencil,
  SendHorizontal,
  Signal,
  Square,
  Wifi,
} from "lucide-react";
import type { CSSProperties } from "react";
import { Brand } from "../../Brand";
import { CarouselArt, PostArt, ReelArt } from "./art";
import { SPOTS, type Frame } from "./script";

const TOOLS = [
  { key: "hand", Icon: Hand },
  { key: "pin", Icon: MapPin },
  { key: "pen", Icon: Pencil },
  { key: "hl", Icon: Highlighter },
  { key: "box", Icon: Square },
  { key: "arrow", Icon: MoveUpRight },
] as const;

const NAMES = ["Diwali Sale.jpg", "New arrivals.png", "Festive reel.mp4"];

const colorVars = (c: string, on = "#fff") => ({ "--c": c, "--on": on }) as CSSProperties;

function Status({ f }: { f: Frame }) {
  const i = f.item;
  const done = i === 0 ? f.approved0 : f.approved2;
  if (done) return <span className="badge tone-green">You approved this</span>;
  if (f.v2) return <span className="badge tone-blue">New version</span>;
  if (f.changesBadge) return <span className="badge tone-red">Changes sent</span>;
  return null;
}

function Timeline({ f }: { f: Frame }) {
  const { a, b } = SPOTS.range;
  const width = (b - a) * f.range * 100;
  const shown = f.range > 0 || f.rangePosted;
  return (
    <div className="tv-tl">
      <div className="tv-tl-lane">
        {f.rangePosted && (
          <span className="tv-tl-marker" style={{ left: `${a * 100}%`, width: `${(b - a) * 100}%`, ...colorVars("#4a4ab8") }}>
            1
          </span>
        )}
      </div>
      <div className="tv-tl-track">
        <i className="played" style={{ width: `${(f.range > 0 ? a + (b - a) * f.range : a) * 100}%` }} />
        {shown && (
          <span className="sel" style={{ left: `${a * 100}%`, width: `${width}%` }}>
            {f.range >= 0.6 && <em>0:04 – 0:09 · 5s</em>}
          </span>
        )}
        <span className="head" style={{ left: `${(f.range > 0 ? a + (b - a) * f.range : a) * 100}%` }} />
        <u data-cur="track-a" style={{ left: `${a * 100}%` }} />
        <u data-cur="track-b" style={{ left: `${b * 100}%` }} />
      </div>
      <div className="tv-tl-bar">
        <span className="play">
          <Pause size={12} fill="currentColor" />
        </span>
        <span className="clock">
          0:0{f.range > 0 ? Math.min(9, Math.round(4 + 5 * f.range)) : 4} <i>/ 0:12</i>
        </span>
        {f.range >= 1 && !f.rangePosted && <span className="chip-portion">0:04 – 0:09</span>}
      </div>
    </div>
  );
}

function Composer({ f }: { f: Frame }) {
  const c = f.composer;
  if (!c) {
    const n = f.item === 0 ? (f.pinPosted ? 1 : 0) + (f.boxPosted ? 1 : 0) : f.rangePosted ? 1 : 0;
    return (
      <div className="tv-peek">
        <MessageSquare size={15} />
        <b>{n ? `${n} ${n === 1 ? "comment" : "comments"}` : "Comments"}</b>
        <span>{n ? "Sent to Pixel Agency" : f.item === 0 ? "Tap the picture to pin one" : "Drag the timeline to pick a portion"}</span>
      </div>
    );
  }
  return (
    <div className="tv-composer">
      <span className="tv-chip" style={colorVars(c.color)}>
        <i />
        {c.kind === "Portion" ? <Clock3 size={12} /> : c.kind === "Pin" ? <MapPin size={12} /> : <Square size={12} />}
        {c.label}
      </span>
      <div className="row">
        <div className="input">
          {c.text ? <>{c.text}<s /></> : <><span className="ph">Say what should change here…</span><s /></>}
        </div>
        <span className={`send${c.text.length > 3 ? " on" : ""}`} data-cur="send-comment">
          <SendHorizontal size={16} />
        </span>
      </div>
    </div>
  );
}

function Stage({ f }: { f: Frame }) {
  const onPost = f.item === 0;
  const showMarks = onPost && !f.v2;
  const boxA = SPOTS.boxA;
  const boxB = SPOTS.boxB;
  return (
    <div className={`tv-pstage${onPost ? "" : " video"}`}>
      <div className="tv-toolbar">
        {TOOLS.map(({ key, Icon }) => (
          <b key={key} className={f.tool === key ? "on" : ""} data-cur={`tool-${key}`}>
            <Icon size={15} />
          </b>
        ))}
        <i className="ink" />
      </div>
      <div className="tv-canvas">
        <div className="tv-frame">
          {onPost ? <PostArt v={f.v2 ? 2 : 1} /> : <ReelArt />}
          <div className="tv-marks">
            {showMarks && (
              <>
                <u data-cur="pin-spot" style={{ left: `${SPOTS.pin.x}%`, top: `${SPOTS.pin.y}%` }} />
                <u data-cur="box-a" style={{ left: `${boxA.x}%`, top: `${boxA.y}%` }} />
                <u data-cur="box-b" style={{ left: `${boxB.x}%`, top: `${boxB.y}%` }} />
                {f.boxGrow > 0 && (
                  <span
                    className={`tv-box${f.boxPosted ? " done" : ""}`}
                    style={{ left: `${boxA.x}%`, top: `${boxA.y}%`, width: `${(boxB.x - boxA.x) * f.boxGrow}%`, height: `${(boxB.y - boxA.y) * f.boxGrow}%` }}
                  >
                    {f.boxGrow >= 1 && <b style={colorVars("#facc15", "#111827")}>2</b>}
                  </span>
                )}
                {f.pinPlaced && (
                  <span className={`tv-pin${f.pinPosted ? "" : " pending"}`} style={{ left: `${SPOTS.pin.x}%`, top: `${SPOTS.pin.y}%`, ...colorVars("#ef4444") }}>
                    <i>1</i>
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {!onPost && <Timeline f={f} />}
    </div>
  );
}

function Film({ f, i }: { f: Frame; i: number }) {
  const art = i === 0 ? <PostArt v={f.v2 ? 2 : 1} /> : i === 1 ? <CarouselArt /> : <ReelArt />;
  const mark = f.filmMarks[i];
  const current = (i === 0 && f.item === 0) || (i === 2 && f.item === 2);
  return (
    <span className={`tv-film${current ? " current" : ""}`} data-cur={`film-${i + 1}`}>
      {art}
      <em>{i + 1}</em>
      {mark && (
        <b className={`m-${mark}`}>
          {mark === "approved" ? <Check size={10} strokeWidth={3.6} /> : mark === "changes" ? <AlertCircle size={10} strokeWidth={3} /> : <i />}
        </b>
      )}
    </span>
  );
}

function Confetti() {
  const bits = Array.from({ length: 22 }, (_, i) => i);
  const colors = ["#5b5bd6", "#22a06b", "#f59e0b", "#ef4444", "#3b82f6", "#e5548a"];
  return (
    <div className="tv-confetti" aria-hidden>
      {bits.map((i) => (
        <i
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            background: colors[i % colors.length],
            animationDelay: `${(i % 7) * 70}ms`,
            ["--dx" as string]: `${((i * 53) % 90) - 45}px`,
            ["--r" as string]: `${(i * 97) % 360}deg`,
          }}
        />
      ))}
    </div>
  );
}

export function Phone({ f }: { f: Frame }) {
  const reviewed = f.filmMarks.filter((m) => m === "approved" || m === "changes").length;
  const approvedNow = f.item === 0 ? f.approved0 : f.approved2;
  return (
    <div className={`tv-phone-screen${f.phone === "lock" ? " is-lock" : ""}`}>
      <div className="tv-status">
        <b>10:41</b>
        <span>
          <Signal size={12} />
          <Wifi size={12} />
          <BatteryFull size={14} />
        </span>
      </div>

      {/* Lock screen with the message that carries the link */}
      <div className={`tv-lock${f.phone === "lock" ? "" : " gone"}`}>
        <div className="time">10:41</div>
        <div className="date">Tuesday, 14 October</div>
        <div className={`tv-notif${f.notif ? " in" : ""}${f.notifTap ? " tap" : ""}`} data-cur="notif">
          <span className="app">
            <MessageSquareText size={15} />
          </span>
          <div>
            <small>
              <b>Pixel Agency</b> <i>now</i>
            </small>
            <p>Hi Priya! Your Diwali campaign is ready to review 👉 approveflow.com/r/k7Qx9m</p>
          </div>
        </div>
      </div>

      {/* The client's review page */}
      <div className={`tv-rv${f.phone === "app" ? " in" : ""}`}>
        <div className="tv-rv-head">
          <Brand compact iconOnly />
          <div className="t">
            <b>Diwali Campaign</b>
            <span>
              {f.item + 1} of 3 · {NAMES[f.item]}
            </span>
          </div>
          <span className="prog">
            {reviewed}/3
            <i>
              <u style={{ width: `${(reviewed / 3) * 100}%` }} />
            </i>
          </span>
        </div>
        <div className="tv-rail">
          {[0, 1, 2].map((i) => (
            <Film key={i} f={f} i={i} />
          ))}
        </div>
        <div className="tv-ptop">
          <b>{NAMES[f.item]}</b>
          <span>{f.item === 0 ? "Image" : "Video"}{f.v2 ? " · V2" : ""}</span>
          <Status f={f} />
        </div>
        <Stage f={f} />
        <Composer f={f} />
        <div className="tv-decide">
          <div className={`button button-danger-outline${f.changesSent ? " is-sent" : ""}`} data-cur="req-btn">
            {f.changesSent ? <><Check size={14} strokeWidth={3} /> Sent</> : "Request changes"}
          </div>
          <div className={`button button-success${approvedNow ? " is-approved" : ""}`} data-cur="approve-btn">
            <Check size={14} strokeWidth={3} /> {approvedNow ? "Approved" : "Approve"}
          </div>
        </div>
        <div className={`tv-ptoast${f.changesSent ? " in" : ""}`}>
          <Check size={14} strokeWidth={3} /> Feedback sent · thank you
        </div>
      </div>

      {/* All done */}
      <div className={`tv-done${f.phone === "done" ? " in" : ""}`}>
        {f.phone === "done" && <Confetti />}
        <span className="success-icon big">
          <PartyPopper size={34} />
        </span>
        <h3>All done — thank you!</h3>
        <p>Your decisions were sent to Pixel Agency.</p>
        <span className="tag tone-green">
          <Check size={13} strokeWidth={3} /> 3 approved
        </span>
      </div>
    </div>
  );
}
