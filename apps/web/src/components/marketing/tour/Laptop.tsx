import {
  Activity,
  AlertCircle,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FolderOpen,
  Home,
  Link2,
  Lock,
  Mail,
  MessageSquare,
  Plus,
  Send,
  Square,
  UploadCloud,
  Users,
  MapPin,
  PartyPopper,
  Upload,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Brand } from "../../Brand";
import { CarouselArt, PostArt, ReelArt } from "./art";
import { SPOTS, type Frame } from "./script";

const FILES = [
  { name: "diwali-sale.jpg", size: "2.4 MB", art: <PostArt /> },
  { name: "new-arrivals-carousel.png", size: "1.1 MB", art: <CarouselArt /> },
  { name: "festive-reel.mp4", size: "18.6 MB", art: <ReelArt /> },
];

const colorVars = (c: string, on = "#fff") => ({ "--c": c, "--on": on }) as CSSProperties;

function Thumb({ children }: { children: ReactNode }) {
  return <span className="tv-thumb">{children}</span>;
}

function Header({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="tv-ph">
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  );
}

// ---------------------------------------------------------------- Upload

function UploadPage({ f }: { f: Frame }) {
  return (
    <>
      <Header title="Upload content">Add images, videos or PDFs. You’ll send them for approval in the next step.</Header>
      <div className="tv-card tv-form">
        <div className="tv-field">
          <label>Which project is this for?</label>
          <div className="tv-select">
            Kaveri Silks — Diwali Campaign <ChevronDown size={15} />
          </div>
        </div>
        <div className="tv-drop" data-cur="dropzone">
          <span className="dz-icon">
            <UploadCloud size={22} />
          </span>
          <b>Drag files here</b>
          <span>
            or <u>browse your computer</u> · JPG, PNG, GIF, MP4, MOV, PDF
          </span>
          <u className="anchor" data-cur="dropzone-in" />
        </div>
        <ul className="tv-files">
          {FILES.map((file, i) => {
            const s = f.files[i];
            if (!s.shown) return null;
            const done = s.pct >= 1;
            return (
              <li key={file.name} className="tv-rise">
                <Thumb>{file.art}</Thumb>
                <div className="info">
                  <b>{file.name}</b>
                  {done ? (
                    <small>{file.size}</small>
                  ) : (
                    <span className="progress">
                      <span style={{ width: `${Math.round(s.pct * 100)}%` }} />
                    </span>
                  )}
                </div>
                {done ? <CheckCircle2 size={19} className="ok" /> : <small className="pct">{Math.round(s.pct * 100)}%</small>}
              </li>
            );
          })}
        </ul>
        {f.files[0].shown && (
          <div className="tv-actions">
            <div className={`button large ${f.uploaded ? "button-success" : "button-primary"}`} data-cur="upload-btn">
              {f.uploaded ? (
                <>
                  <Check size={16} strokeWidth={3} /> 3 files uploaded
                </>
              ) : (
                "Upload 3 files"
              )}
            </div>
            {f.nextShown && (
              <div className="button button-secondary large tv-pop" data-cur="next-btn">
                <Send size={16} /> Send for approval
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Send

function SendPage({ f }: { f: Frame }) {
  const chosen = f.picks.filter(Boolean).length;
  return (
    <>
      <Header title="Send for approval" />
      <div className="tv-card">
        <div className="tv-step">
          <span className="n">1</span>
          <div>
            <h2>What should they review?</h2>
            <p>Kaveri Silks — Diwali Campaign</p>
          </div>
          <small className="sel">
            <b>{chosen}</b> of 3 selected
          </small>
        </div>
        <div className="tv-picks">
          {FILES.map((file, i) => (
            <div key={file.name} className={`tv-pick${f.picks[i] ? " on" : ""}`}>
              <Thumb>
                {file.art}
                <span className="check">{f.picks[i] && <Check size={12} strokeWidth={3.4} />}</span>
              </Thumb>
              <b>{file.name}</b>
              <span className="badge tone-blue">Ready to send</span>
            </div>
          ))}
        </div>
      </div>
      <div className="tv-card">
        <div className="tv-step">
          <span className="n">2</span>
          <div>
            <h2>Who should approve it?</h2>
            <p>Filled in from your client details.</p>
          </div>
        </div>
        <div className="tv-row">
          <div className="tv-field">
            <label>Name</label>
            <div className={`tv-input${f.reviewerGlow ? " glow" : ""}`}>Priya Nair</div>
          </div>
          <div className="tv-field">
            <label>Email</label>
            <div className={`tv-input${f.reviewerGlow ? " glow" : ""}`}>priya@kaverisilks.in</div>
          </div>
          <div className="tv-toggle" data-cur="toggle">
            <span className={`switch${f.reminders ? " on" : ""}`} />
            <span>
              <b>Friendly reminders</b>
              <small>Nudges if they haven’t replied</small>
            </span>
          </div>
        </div>
      </div>
      <div className="tv-sticky">
        <span>{chosen} files ready to send</span>
        <div className="button button-primary large" data-cur="submit">
          {f.sending ? (
            <>
              <i className="tv-spin" /> Sending…
            </>
          ) : (
            <>
              <Send size={16} /> Send for approval
            </>
          )}
        </div>
      </div>
      {f.linkReady && (
        <div className="tv-over">
          <div className="tv-share">
            <span className="success-icon">
              <Check size={26} strokeWidth={3} />
            </span>
            <h2>Sent — Priya can review now</h2>
            <p>One private link. No account or password needed.</p>
            <div className="tv-linkbox">
              <span>
                <Lock size={14} /> approveflow.com/r/k7Qx9mR2vT
              </span>
              <div className={`button small ${f.copied ? "button-success" : "button-primary"}`} data-cur="copy">
                {f.copied ? (
                  <>
                    <Check size={14} strokeWidth={3} /> Copied
                  </>
                ) : (
                  <>
                    <Link2 size={14} /> Copy link
                  </>
                )}
              </div>
            </div>
            <small className="mail">
              <Mail size={13} /> Emailed to priya@kaverisilks.in
            </small>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- Live review

const STATUS = {
  waiting: { tone: "amber", label: "Waiting for Priya" },
  changes: { tone: "red", label: "Changes requested" },
  v2: { tone: "blue", label: "Version 2 sent" },
  approved: { tone: "green", label: "Approved" },
} as const;

function LivePage({ f }: { f: Frame }) {
  const s = STATUS[f.liveStatus];
  const { boxA, boxB, pin } = SPOTS;
  return (
    <>
      <header className="tv-ph row">
        <div>
          <small className="back">Kaveri Silks · Diwali Campaign</small>
          <h1>Diwali Sale.jpg</h1>
        </div>
        <div className="right">
          {f.viewing && f.liveStatus === "waiting" && (
            <span className="tv-live">
              <i /> Priya is viewing
            </span>
          )}
          <span className={`badge tone-${s.tone}`}>{s.label}</span>
        </div>
      </header>
      <div className="tv-live-grid">
        <div className="tv-lstage">
          <div className="top">
            <b>Diwali Sale.jpg</b>
            <span>Version {f.liveV2 ? 2 : 1}</span>
          </div>
          <div className="cv">
            <div className="tv-frame">
              <PostArt v={f.liveV2 ? 2 : 1} />
              {!f.liveV2 && (
                <div className="tv-marks">
                  {f.boxPosted && (
                    <span className="tv-box done" style={{ left: `${boxA.x}%`, top: `${boxA.y}%`, width: `${boxB.x - boxA.x}%`, height: `${boxB.y - boxA.y}%` }}>
                      <b style={colorVars("#facc15", "#111827")}>2</b>
                    </span>
                  )}
                  {f.pinPosted && (
                    <span className="tv-pin" style={{ left: `${pin.x}%`, top: `${pin.y}%`, ...colorVars("#ef4444") }}>
                      <i>1</i>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <aside className="tv-lpanel">
          <div className="head">
            <b>Feedback</b>
            <span className="count">{f.liveV2 ? 0 : f.comments >= 2 ? 2 : f.comments}</span>
          </div>
          {f.liveV2 ? (
            <p className="older">Priya’s earlier notes stay on version 1, so nothing gets lost.</p>
          ) : (
            <ul>
              {f.pinPosted && (
                <li className="tv-rise">
                  <span className="cbadge" style={colorVars("#ef4444")}>1</span>
                  <div>
                    <div className="meta">
                      <b>Priya</b> <time>just now</time>
                    </div>
                    <p>Make the offer text bigger</p>
                    <span className="chip">
                      <MapPin size={11} /> Pin
                    </span>
                  </div>
                </li>
              )}
              {f.boxPosted && (
                <li className="tv-rise">
                  <span className="cbadge" style={colorVars("#facc15", "#111827")}>2</span>
                  <div>
                    <div className="meta">
                      <b>Priya</b> <time>just now</time>
                    </div>
                    <p>Make this button pop</p>
                    <span className="chip">
                      <Square size={11} /> Box
                    </span>
                  </div>
                </li>
              )}
              {!f.pinPosted && (
                <li className="empty">
                  <span>
                    <MessageSquare size={18} />
                  </span>
                  Feedback shows up here the moment Priya sends it.
                </li>
              )}
            </ul>
          )}
        </aside>
      </div>
      <div className={`tv-note${f.toast3 ? " in" : ""}`}>
        <span className="stat-icon tone-primary">
          <Clock3 size={16} />
        </span>
        <div>
          <b>New comment on Festive reel</b>
          <small>“Trim this part” · 0:04 – 0:09</small>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Dashboard

const EVENTS = [
  { Icon: CheckCircle2, tone: "green", who: "Priya", verb: "approved Festive reel" },
  { Icon: CheckCircle2, tone: "green", who: "Priya", verb: "approved Diwali Sale" },
  { Icon: Upload, tone: "blue", who: "You", verb: "uploaded 2 new versions" },
  { Icon: AlertCircle, tone: "red", who: "Priya", verb: "requested changes" },
];

function Kpi({ Icon, tone, value, label, hot }: { Icon: typeof Bell; tone: string; value: number; label: string; hot?: boolean }) {
  return (
    <div className={`tv-kpi${hot ? " hot" : ""}`}>
      <span className={`stat-icon tone-${tone}`}>
        <Icon size={17} />
      </span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function DashPage({ f }: { f: Frame }) {
  const e = 1 - f.count;
  const changes = Math.round(3 * e);
  const approved = Math.round(3 * f.count);
  return (
    <>
      <Header title="Good morning">Here’s where approvals stand at Pixel Agency.</Header>
      <div className="tv-kpis">
        <Kpi Icon={AlertCircle} tone="red" value={changes} label="Need your changes" hot={changes > 0} />
        <Kpi Icon={Clock3} tone="amber" value={0} label="Waiting for client" />
        <Kpi Icon={Send} tone="blue" value={0} label="Ready to send" />
        <Kpi Icon={CheckCircle2} tone="green" value={approved} label="Approved" />
      </div>
      <div className="tv-split">
        <section className="tv-card tv-compact-hide">
          <div className="tv-card-head">
            <div>
              <h2>Diwali Campaign</h2>
              <p>Kaveri Silks</p>
            </div>
            <span className={`badge ${f.count >= 1 ? "tone-green" : "tone-amber"}`}>{f.count >= 1 ? "All approved" : "In review"}</span>
          </div>
          <ul className="tv-assets">
            {FILES.map((file, i) => (
              <li key={file.name}>
                <Thumb>{file.art}</Thumb>
                <b>{file.name}</b>
                <span className={`badge tone-${f.count >= 0.3 + i * 0.2 ? "green" : "red"}`}>{f.count >= 0.3 + i * 0.2 ? "Approved" : "Changes"}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="tv-card">
          <div className="tv-card-head">
            <h2>Recent activity</h2>
          </div>
          <ul className="tv-feed">
            {EVENTS.map(({ Icon, tone, who, verb }, i) =>
              f.dashEvents[i] ? (
                <li key={verb} className="tv-rise">
                  <span className={`ico tone-${tone}`}>
                    <Icon size={14} />
                  </span>
                  <div>
                    <p>
                      <b>{who}</b> {verb}
                    </p>
                    <time>just now</time>
                  </div>
                </li>
              ) : null,
            )}
          </ul>
        </section>
      </div>
      <div className={`tv-note good${f.dashToast ? " in" : ""}`}>
        <span className="stat-icon tone-green">
          <PartyPopper size={16} />
        </span>
        <div>
          <b>Priya approved 3 items</b>
          <small>just now · no chasing needed</small>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Shell

const NAV = [
  { label: "Home", Icon: Home },
  { label: "Clients", Icon: Users },
  { label: "Projects", Icon: FolderOpen },
  { label: "Activity", Icon: Activity },
];

const ROUTES = { upload: "app/upload", send: "app/approvals/new", live: "app/assets/diwali-sale", dash: "app/dashboard" } as const;
const ACTIVE = { upload: 2, send: 2, live: 2, dash: 0 } as const;

export function Laptop({ f }: { f: Frame }) {
  const active = ACTIVE[f.laptop];
  return (
    <div className="tv-laptop">
      <div className="tv-bar">
        <span />
        <span />
        <span />
        <em>
          <Lock size={10} /> approveflow.com/{ROUTES[f.laptop]}
        </em>
      </div>
      <div className="tv-app">
        <aside className="tv-side">
          <Brand compact />
          <div className="button button-primary tv-side-cta">
            <Plus size={15} /> Upload content
          </div>
          <nav>
            {NAV.map(({ label, Icon }, i) => (
              <span key={label} className={`tv-nav${i === active ? " active" : ""}`}>
                <Icon size={16} /> {label}
                {label === "Projects" && f.changesBadge && f.liveStatus === "changes" && <em className="tv-nbadge">3</em>}
              </span>
            ))}
          </nav>
          <span className="who">
            <i>PA</i>
            <b>Pixel Agency</b>
            <small>Studio plan</small>
          </span>
        </aside>
        <main className="tv-main">
          <div className="tv-page" key={f.laptop}>
            {f.laptop === "upload" && <UploadPage f={f} />}
            {f.laptop === "send" && <SendPage f={f} />}
            {f.laptop === "live" && <LivePage f={f} />}
            {f.laptop === "dash" && <DashPage f={f} />}
          </div>
        </main>
      </div>
    </div>
  );
}
