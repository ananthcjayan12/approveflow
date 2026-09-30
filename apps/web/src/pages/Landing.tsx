import { useEffect, useState } from "react";
import {
  ArrowRight,
  BellRing,
  Check,
  ChevronDown,
  Highlighter,
  History,
  Link2,
  Lock,
  Menu,
  Pencil,
  Send,
  SquareDashedMousePointer,
  UploadCloud,
  UserX,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import { PlanCards } from "../components/PlanCards";
import { ThemeToggle } from "../components/ThemeToggle";
import { MOCK_TOOLS, MarkupArt, ReviewMock, TimelineArt } from "../components/marketing/Mock";

const steps = [
  { Icon: UploadCloud, title: "Upload your content", body: "Drag in images, carousels, videos or PDFs. Everything stays private." },
  { Icon: Send, title: "Send one link", body: "Share it on WhatsApp or email. Your client never needs an account." },
  { Icon: Check, title: "Get it approved", body: "They approve, or point, draw and comment on exactly what to change." },
];

const faqs = [
  {
    q: "Do my clients need to create an account?",
    a: "No. Clients open a private link and review straight away — no sign-up, no password, no app to install. It works on phones and tablets too.",
  },
  {
    q: "What can a client do on an image?",
    a: "Drop a pin, draw freehand, highlight, and add boxes, circles and arrows in any colour. They can zoom in for detail and then write what should change.",
  },
  {
    q: "How do comments on video work?",
    a: "Clients pause on a moment and comment, or drag along the timeline to select a portion of the video. They can also draw right on the frame. You can select any portion later to see just the comments in it.",
  },
  {
    q: "Which files can I upload?",
    a: "JPG, PNG, WebP and GIF images, MP4, MOV and WebM video, and PDFs. Large videos upload straight to private storage.",
  },
  {
    q: "What happens when I upload a fix?",
    a: "Upload a new version and your client sees it on the same link. Earlier comments stay attached to the version they were made on, so nothing gets lost.",
  },
  {
    q: "Is my clients’ work kept private?",
    a: "Yes. Files live in private storage and are only reachable through your review links, which are random and stored as hashes.",
  },
];

const nav = [
  ["Features", "#features"],
  ["How it works", "#how"],
  ["Pricing", "#pricing"],
  ["FAQ", "#faq"],
] as const;

export default function Landing() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <div className="site">
      <header className={`site-nav-wrap${scrolled ? " is-scrolled" : ""}`}>
        <div className="site-nav">
          <Link to="/" aria-label="ApproveFlow home">
            <Brand />
          </Link>
          <nav className="site-links" aria-label="Sections">
            {nav.map(([label, href]) => (
              <a key={href} href={href}>{label}</a>
            ))}
          </nav>
          <div className="site-nav-cta">
            <ThemeToggle />
            <Link className="link-quiet hide-mobile" to="/login">Log in</Link>
            <Link className="button button-primary" to="/signup">Start free</Link>
            <button className="icon-button ghost menu-toggle" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="site-menu" aria-label="Menu">
            {nav.map(([label, href]) => (
              <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>
            ))}
            <Link to="/login">Log in</Link>
          </nav>
        )}
      </header>

      <main>
      <section className="hero">
        <div className="hero-copy">
          <a className="hero-pill" href="#features">
            <span>New</span> Draw, highlight and comment on video timelines <ArrowRight size={14} />
          </a>
          <h1>
            Client approvals, <span className="accent">without the back-and-forth.</span>
          </h1>
          <p>
            Send your posts, reels and designs in one private link. Your client points, draws and comments right on the
            work — and you see exactly what to change. No more chasing feedback across WhatsApp and email.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary large" to="/signup">
              Start free <ArrowRight size={18} />
            </Link>
            <a className="button button-secondary large" href="#how">See how it works</a>
          </div>
          <ul className="hero-points">
            <li><Check size={16} /> No client logins</li>
            <li><Check size={16} /> Free trial, no card</li>
            <li><Check size={16} /> Works on phone &amp; tablet</li>
          </ul>
        </div>
        <ReviewMock />
      </section>

      <section className="section" id="features">
        <div className="section-head">
          <span className="eyebrow">Features</span>
          <h2>Everything a review needs. Nothing it doesn’t.</h2>
          <p>Built for social media managers and small studios who are tired of vague feedback.</p>
        </div>
        <div className="bento">
          <article className="bento-card bento-a">
            <div className="bento-text">
              <span className="stat-icon tone-primary"><Pencil size={20} /></span>
              <h3>Mark up anything</h3>
              <p>Pins, freehand pen, highlighter, boxes, circles and arrows — in any colour. Clients zoom in and show you precisely what they mean.</p>
            </div>
            <div className="bento-visual art-stage">
              <div className="art-tools">
                {MOCK_TOOLS.map((Icon, i) => (
                  <b key={i} className={i === 2 ? "on" : ""}><Icon size={15} /></b>
                ))}
              </div>
              <MarkupArt />
            </div>
          </article>
          <article className="bento-card bento-b">
            <div className="bento-text">
              <span className="stat-icon tone-blue"><SquareDashedMousePointer size={20} /></span>
              <h3>Comment on a moment — or a portion</h3>
              <p>Drag along the timeline to select part of a video, then see only the comments inside it.</p>
            </div>
            <TimelineArt />
          </article>
          <article className="bento-card bento-c">
            <span className="stat-icon tone-green"><UserX size={20} /></span>
            <h3>No client logins</h3>
            <p>Clients open a link and review. No passwords, no app to install.</p>
          </article>
          <article className="bento-card bento-c">
            <span className="stat-icon tone-amber"><History size={20} /></span>
            <h3>Every version, tracked</h3>
            <p>Upload a fix and the client sees it on the same link.</p>
          </article>
          <article className="bento-card bento-c">
            <span className="stat-icon tone-red"><BellRing size={20} /></span>
            <h3>Friendly reminders</h3>
            <p>Automatic nudges so you never have to chase anyone.</p>
          </article>
          <article className="bento-card bento-c">
            <span className="stat-icon tone-gray"><Lock size={20} /></span>
            <h3>Private by default</h3>
            <p>Files stay in private storage; only your link opens them.</p>
          </article>
        </div>
      </section>

      <section className="pain">
        <h2>Sound familiar?</h2>
        <div className="pain-grid">
          <div><Highlighter size={22} /><b>“Make it pop”</b><span>Feedback nobody can act on.</span></div>
          <div><Link2 size={22} /><b>“Which version?”</b><span>Nobody’s sure what was approved.</span></div>
          <div><BellRing size={22} /><b>Days of waiting</b><span>For a simple “looks good”.</span></div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="section-head">
          <span className="eyebrow">How it works</span>
          <h2>Three steps. That’s it.</h2>
        </div>
        <ol className="how-grid">
          {steps.map(({ Icon, title, body }, i) => (
            <li key={title} className="how-card">
              <span className="how-num">{i + 1}</span>
              <span className="stat-icon tone-primary"><Icon size={22} /></span>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section" id="pricing">
        <div className="section-head">
          <span className="eyebrow">Pricing</span>
          <h2>Simple plans. Start free.</h2>
          <p>Try everything free, then pick the plan that fits. Cancel any time.</p>
        </div>
        <PlanCards
          action={(plan) => (
            <Link className={`button full ${plan.popular ? "button-primary" : "button-secondary"}`} to="/signup">
              Start free trial
            </Link>
          )}
        />
      </section>

      <section className="section narrow" id="faq">
        <div className="section-head">
          <span className="eyebrow">FAQ</span>
          <h2>Questions, answered</h2>
        </div>
        <div className="faq">
          {faqs.map(({ q, a }) => (
            <details key={q}>
              <summary>
                {q} <ChevronDown size={18} />
              </summary>
              <p>{a}</p>
            </details>
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

      </main>

      <footer className="site-footer">
        <Brand compact />
        <nav aria-label="Footer">
          <a href="#features">Features</a>
          <Link to="/pricing">Pricing</Link>
          <Link to="/login">Log in</Link>
          <Link to="/signup">Sign up</Link>
        </nav>
        <span>© {new Date().getFullYear()} ApproveFlow</span>
      </footer>
    </div>
  );
}
