import { Check, Circle, Hand, Highlighter, MapPin, MoveUpRight, Pencil, Square } from "lucide-react";

/**
 * Illustrations of the product, built from the same tokens and shapes as the
 * real review workspace. Decorative only, so hidden from assistive tech.
 */

/** A social post with reviewer markup drawn on it. */
export function MarkupArt({ className = "" }: { className?: string }) {
  return (
    <svg className={`markup-art ${className}`} viewBox="0 0 400 300" role="img" aria-label="A social media post with a client's drawn feedback" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="art-bg" x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#ff9a62" />
          <stop offset="0.55" stopColor="#e5548a" />
          <stop offset="1" stopColor="#7b2ff7" />
        </linearGradient>
        <filter id="art-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#000" floodOpacity="0.45" />
        </filter>
      </defs>
      <rect width="400" height="300" fill="url(#art-bg)" />
      <circle cx="330" cy="40" r="90" fill="#fff" opacity="0.08" />
      <text x="36" y="118" fill="#fff" fontSize="58" fontWeight="800" letterSpacing="-2">Diwali</text>
      <text x="36" y="176" fill="#fff" fontSize="58" fontWeight="800" letterSpacing="-2">Sale</text>
      <text x="38" y="208" fill="#fff" fontSize="15" fontWeight="500" opacity="0.92">Up to 40% off · This weekend only</text>
      <rect x="36" y="232" width="110" height="34" rx="17" fill="#fff" opacity="0.92" />
      <text x="91" y="254" fill="#7b2ff7" fontSize="13" fontWeight="800" textAnchor="middle">SHOP NOW</text>

      <g filter="url(#art-shadow)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <rect className="art-draw" x="28" y="58" width="214" height="126" rx="10" stroke="#ef4444" strokeWidth="3.2" fill="#ef4444" fillOpacity="0.1" pathLength={1} />
        <path className="art-draw art-d2" d="M300 236 Q 262 196 214 210" stroke="#facc15" strokeWidth="3.2" pathLength={1} />
        <path className="art-draw art-d2" d="M214 210 l 11 -13 M214 210 l 16 6" stroke="#facc15" strokeWidth="3.2" pathLength={1} />
        <path className="art-draw art-d3" d="M40 224 q 12 -8 24 0 t 24 0 t 24 0" stroke="#fff" strokeWidth="2.6" pathLength={1} opacity="0.0" />
      </g>
      <rect x="40" y="188" width="166" height="15" rx="4" fill="#facc15" opacity="0.5" />

      <g>
        <circle cx="28" cy="58" r="11" fill="#ef4444" stroke="#fff" strokeWidth="2" />
        <text x="28" y="62.5" fill="#fff" fontSize="12" fontWeight="800" textAnchor="middle">1</text>
        <circle cx="300" cy="236" r="11" fill="#facc15" stroke="#fff" strokeWidth="2" />
        <text x="300" y="240.5" fill="#111827" fontSize="12" fontWeight="800" textAnchor="middle">2</text>
      </g>
    </svg>
  );
}

const TOOLS = [Hand, MapPin, Pencil, Highlighter, Square, Circle, MoveUpRight];

function MiniTimeline() {
  return (
    <div className="mock-timeline" aria-hidden>
      <div className="mock-lane">
        <span className="mock-marker range" style={{ left: "28%", width: "34%" }}>2</span>
        <span className="mock-marker dot" style={{ left: "44%" }}>1</span>
      </div>
      <div className="mock-track">
        <i style={{ width: "44%" }} />
        <span className="mock-band" style={{ left: "28%", width: "34%" }}>
          <em>0:04 – 0:09 · 5s</em>
        </span>
        <span className="mock-head" style={{ left: "44%" }} />
      </div>
    </div>
  );
}

/** The hero illustration: a whole review screen. */
export function ReviewMock() {
  return (
    <div className="review-mock" aria-hidden>
      <div className="mock-window">
        <div className="mock-bar">
          <span />
          <span />
          <span />
          <em>approveflow.app/review/…</em>
        </div>
        <div className="mock-body">
          <div className="mock-stage">
            <div className="mock-tools">
              {TOOLS.map((Icon, i) => (
                <b key={i} className={i === 3 ? "on" : ""}>
                  <Icon size={14} />
                </b>
              ))}
              <i style={{ background: "#ef4444" }} />
            </div>
            <div className="mock-canvas">
              <MarkupArt />
            </div>
            <MiniTimeline />
          </div>
          <div className="mock-side">
            <div className="mock-side-head">Comments <span>3</span></div>
            <div className="mock-comment">
              <span className="mock-num" style={{ background: "#ef4444" }}>1</span>
              <div>
                <b>Priya</b>
                <p>Can the offer text be bigger?</p>
              </div>
            </div>
            <div className="mock-comment">
              <span className="mock-num" style={{ background: "#facc15", color: "#111827" }}>2</span>
              <div>
                <b>Priya</b>
                <p>Point the arrow at the button.</p>
                <em>0:04 – 0:09</em>
              </div>
            </div>
            <div className="mock-actions">
              <span className="button button-danger-outline small">Request changes</span>
              <span className="button button-success small">
                <Check size={14} strokeWidth={3} /> Approve
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="mock-toast">
        <span className="stat-icon tone-green">
          <Check size={16} strokeWidth={3} />
        </span>
        <div>
          <b>Priya approved 4 posts</b>
          <small>just now</small>
        </div>
      </div>
    </div>
  );
}

/** A compact timeline illustration for feature cards. */
export function TimelineArt() {
  return (
    <div className="timeline-art" aria-hidden>
      <div className="mock-frame">
        <div className="mock-frame-bars"><i /><i /><i /><i /><i /></div>
      </div>
      <MiniTimeline />
    </div>
  );
}

export { TOOLS as MOCK_TOOLS };
