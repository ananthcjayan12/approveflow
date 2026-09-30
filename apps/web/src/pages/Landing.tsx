import { ArrowUpRight, CheckCircle2, Play, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/Brand';

export default function Landing() {
  return (
    <div className="marketing-page">
      <div className="ticker">SOCIAL CONTENT · CLIENT REVIEW · APPROVALS · LESS CHASING</div>
      <header className="marketing-nav">
        <Brand />
        <nav><a href="#features">Features</a><a href="#how">How it works</a><Link to="/pricing">Pricing</Link></nav>
        <div className="nav-cta"><Link to="/login">Log in</Link><Link className="button button-primary" to="/signup">Get started <ArrowUpRight size={16}/></Link></div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow warm">UPLOAD · SHARE · REVIEW · APPROVE</div>
          <h1>Client <span>approval</span> without the chaos.</h1>
          <p>Send images, carousels, captions and video through one clean link. Clients can mark exactly what needs changing — no account required.</p>
          <div className="hero-actions"><Link className="button button-primary large" to="/signup">Start free <ArrowUpRight size={18}/></Link><Link className="button button-ghost large" to="/signup"><Play size={16}/> Try client approvals</Link></div>
          <div className="micro-benefits"><span><CheckCircle2/> No client logins</span><span><CheckCircle2/> Visual annotations</span><span><CheckCircle2/> Automatic reminders</span></div>
        </div>
        <div className="hero-stage" aria-label="Product preview">
          <div className="poster poster-one"><span>GOOD<br/>CONTENT<br/><b>GETS<br/>APPROVED.</b></span></div>
          <div className="poster poster-two"><span>LESS<br/>CHASING.<br/><b>MORE<br/>CREATING.</b></span></div>
          <div className="poster poster-three"><span>MARK IT.<br/><b>FIX IT.</b><br/>APPROVE IT.</span></div>
          <div className="comment-float first"><span className="avatar xsmall">P</span><div><b>Looks great!</b><small>Approved ✓</small></div></div>
          <div className="comment-float second"><span className="avatar xsmall">J</span><div><b>Can we move this?</b><small>00:12–00:18</small></div></div>
          <Sparkles className="spark spark-one" />
          <Sparkles className="spark spark-two" />
        </div>
      </section>

      <section className="feature-strip" id="features">
        <article><span>01</span><h3>Upload once</h3><p>Images, carousels, PDFs and large video files.</p></article>
        <article><span>02</span><h3>Share one link</h3><p>Your client reviews without creating an account.</p></article>
        <article><span>03</span><h3>Get exact feedback</h3><p>Image pins, slide references and video timestamps.</p></article>
        <article><span>04</span><h3>Move forward</h3><p>Approvals, revisions and history stay together.</p></article>
      </section>

      <section className="workflow-section" id="how">
        <div><div className="eyebrow">THE SIMPLE FLOW</div><h2>From creative to approved in fewer clicks.</h2></div>
        <div className="workflow-card"><b>Send</b><span>→</span><b>Review</b><span>→</span><b>Mark</b><span>→</span><b>Revise</b><span>→</span><b>Approve</b></div>
      </section>
    </div>
  );
}
