import { Check, Circle, Hand, Highlighter, Link2, Lock, Mail, MapPin, MessageCircle, MoveUpRight, Pause, Pencil, Square, UploadCloud } from "lucide-react";
import { PostArt, ReelArt } from "./tour/art";

/**
 * Small looping demos for the feature cards. Pure CSS animation, so they cost
 * nothing while off screen and fall back to a finished still for reduced motion.
 */

const TOOLS = [Hand, MapPin, Highlighter, Square, MoveUpRight, Pencil, Circle];
/** Which tool lights up in each phase of the loop (index into TOOLS, delay in seconds). */
const PHASES: Array<[number, number]> = [
  [1, 0.4],
  [2, 2.8],
  [3, 5.2],
  [4, 7.6],
];

/** A post being marked up: pin, highlighter, box, then an arrow, each with the client's note. */
export function MarkupLive() {
  return (
    <div className="la-stage">
      <div className="art-tools la-tools">
        {TOOLS.map((Icon, i) => {
          const phase = PHASES.find(([t]) => t === i);
          return (
            <b key={i} className={phase ? "la-tool" : ""} style={phase ? { animationDelay: `${phase[1]}s` } : undefined}>
              <Icon size={15} />
            </b>
          );
        })}
      </div>
      <div className="la-frame">
        <PostArt />
        <span className="la-hl" />
        <span className="la-pin">
          <i>1</i>
        </span>
        <span className="la-box">
          <b>3</b>
        </span>
        <svg className="la-arrow" viewBox="0 0 100 75" aria-hidden>
          <path d="M84 60 Q 66 50 44 57" pathLength={1} />
          <path d="M44 57 l 7 -6 M44 57 l 8 4" pathLength={1} />
        </svg>
        <span className="la-hlnum">
          <b>2</b>
        </span>
        <span className="la-arrownum">
          <b>4</b>
        </span>
        <span className="la-note n1">Bigger offer text</span>
        <span className="la-note n2">Highlight the dates</span>
        <span className="la-note n3">Make this button pop</span>
        <span className="la-note n4">Point at the button</span>
      </div>
    </div>
  );
}

/** Picking a portion of a video on the timeline and leaving a note on it. */
export function PortionLive() {
  return (
    <div className="la-stage la-video">
      <div className="la-vframe">
        <ReelArt />
      </div>
      <div className="la-tl">
        <div className="la-lane">
          <span className="la-marker">1</span>
        </div>
        <div className="la-track">
          <i className="la-played" />
          <span className="la-sel">
            <em>0:04 – 0:09 · 5s</em>
          </span>
          <span className="la-head" />
        </div>
        <div className="la-bar">
          <span className="la-play">
            <Pause size={11} fill="currentColor" />
          </span>
          <span className="la-vnote">“Trim this part”</span>
        </div>
      </div>
    </div>
  );
}

/** Step 1: files landing with progress bars. */
export function HowUpload() {
  return (
    <div className="how-art" aria-hidden>
      <div className="ha-drop">
        <UploadCloud size={16} />
        {[0, 1, 2].map((i) => (
          <div key={i} className="ha-file" style={{ animationDelay: `${i * 0.5}s` }}>
            <span className="ha-th" />
            <span className="ha-bar">
              <u style={{ animationDelay: `${i * 0.5}s` }} />
            </span>
            <Check size={12} strokeWidth={3.4} style={{ animationDelay: `${i * 0.5}s` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Step 2: a private link being copied and sent. */
export function HowLink() {
  return (
    <div className="how-art" aria-hidden>
      <div className="ha-link">
        <span className="ha-url">
          <Lock size={12} /> approveflow.com/r/k7Qx9m…
        </span>
        <span className="ha-copy">
          <span className="a">
            <Link2 size={12} /> Copy
          </span>
          <span className="b">
            <Check size={12} strokeWidth={3.4} /> Copied
          </span>
        </span>
      </div>
      <div className="ha-sent">
        <span>
          <MessageCircle size={12} /> WhatsApp
        </span>
        <span>
          <Mail size={12} /> Email
        </span>
      </div>
    </div>
  );
}

/** Step 3: the stamp of approval. */
export function HowApprove() {
  return (
    <div className="how-art" aria-hidden>
      <div className="ha-card">
        <div className="ha-post">
          <PostArt />
        </div>
        <span className="ha-stamp">
          <Check size={13} strokeWidth={3.6} /> Approved
        </span>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <i key={i} className="ha-dot" style={{ ["--a" as string]: `${i * 60}deg` }} />
        ))}
      </div>
    </div>
  );
}
