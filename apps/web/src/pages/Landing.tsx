import {
  ArrowRight,
  BellRing,
  Check,
  Clock3,
  History,
  Link2,
  Lock,
  MapPin,
  MessageSquareX,
  Send,
  UploadCloud,
  UserX,
  Video,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";

function ProductMock() {
  return (
    <div className="mock" aria-hidden>
      <div className="mock-window">
        <div className="mock-bar">
          <span />
          <span />
          <span />
          <em>approveflow.app/review/…</em>
        </div>
        <div className="mock-body">
          <div className="mock-art">
            <div className="mock-art-text">
              Diwali
              <br />
              Sale
              <small>Up to 40% off</small>
            </div>
            <span className="pin mock-pin" style={{ left: "68%", top: "30%" }}>1</span>
            <span className="pin mock-pin" style={{ left: "80%", top: "58%" }}>2</span>
          </div>
          <div className="mock-side">
            <div className="mock-comment">
              <span className="pin static">1</span>
              <div>
                <b>Priya</b>
                <p>Can the logo be a little bigger?</p>
              </div>
            </div>
            <div className="mock-comment">
              <span className="pin static">2</span>
              <div>
                <b>Priya</b>
                <p>Love this colour!</p>
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

const steps = [
  { Icon: UploadCloud, title: "Upload your content", body: "Drag in images, carousels, videos or PDFs." },
  { Icon: Send, title: "Send one link", body: "Share it on WhatsApp or email. Your client doesn’t need an account." },
  { Icon: Check, title: "Get approved", body: "They approve or point at exactly what to change. You see it instantly." },
];

const features = [
  { Icon: UserX, title: "No client logins", body: "Clients open a link and review. No passwords, no app to install." },
  { Icon: MapPin, title: "Pin comments on images", body: "“Make this bigger” — pinned right on the spot, not lost in a chat." },
  { Icon: Video, title: "Comments on video moments", body: "Feedback lands on the exact second, or a range, of your reel." },
  { Icon: History, title: "Every version, tracked", body: "Upload a fix and the client sees it on the same link." },
  { Icon: BellRing, title: "Friendly reminders", body: "Automatic nudges so you don’t have to chase anyone." },
  { Icon: Lock, title: "Private & secure", body: "Files stay private. Only people with your link can see them." },
];

export default function Landing() {
  return (
    <div className="site">
      <header className="site-nav">
        <Brand />
        <nav>
          <a href="#how">How it works</a>
          <Link to="/pricing">Pricing</Link>
        </nav>
        <div className="site-nav-cta">
          <Link className="link-quiet" to="/login">
            Log in
          </Link>
          <Link className="button button-primary" to="/signup">
            Start free
          </Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="pill">For social media managers & creative studios</span>
          <h1>
            Get client approvals in <span className="accent">minutes</span>, not days.
          </h1>
          <p>
            Send your posts, reels and designs in one link. Your client taps to approve or points at exactly what to
            change. No more chasing feedback across WhatsApp and email.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary large" to="/signup">
              Start your free trial <ArrowRight size={18} />
            </Link>
            <a className="button button-secondary large" href="#how">
              See how it works
            </a>
          </div>
          <ul className="hero-points">
            <li><Check size={16} /> Free trial, no card needed</li>
            <li><Check size={16} /> Set up in 5 minutes</li>
          </ul>
        </div>
        <ProductMock />
      </section>

      <section className="pain">
        <h2>Sound familiar?</h2>
        <div className="pain-grid">
          <div><MessageSquareX size={22} /><b>Feedback scattered</b><span>across WhatsApp, email and calls.</span></div>
          <div><Clock3 size={22} /><b>Waiting for days</b><span>for a simple “looks good”.</span></div>
          <div><Link2 size={22} /><b>“Which version?”</b><span>Nobody’s sure what was approved.</span></div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="section-head">
          <span className="eyebrow">How it works</span>
          <h2>Three steps. That’s it.</h2>
        </div>
        <ol className="how-grid">
          {steps.map(({ Icon, title, body }, i) => (
            <li key={title} className="card">
              <span className="how-num">{i + 1}</span>
              <span className="stat-icon tone-primary"><Icon size={22} /></span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Features</span>
          <h2>Everything you need. Nothing you don’t.</h2>
        </div>
        <div className="feature-grid">
          {features.map(({ Icon, title, body }) => (
            <div key={title} className="feature">
              <span className="stat-icon tone-primary"><Icon size={20} /></span>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <h2>Spend less time chasing, more time creating.</h2>
        <p>Start your free trial today. Your first approval can go out in the next five minutes.</p>
        <Link className="button button-white large" to="/signup">
          Get started free <ArrowRight size={18} />
        </Link>
      </section>

      <footer className="site-footer">
        <Brand compact />
        <nav>
          <Link to="/pricing">Pricing</Link>
          <Link to="/login">Log in</Link>
          <Link to="/signup">Sign up</Link>
        </nav>
        <span>© {new Date().getFullYear()} ApproveFlow</span>
      </footer>
    </div>
  );
}
