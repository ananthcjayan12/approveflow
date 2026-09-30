import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import { PlanCards } from "../components/PlanCards";
import { ThemeToggle } from "../components/ThemeToggle";

export default function Pricing() {
  return (
    <div className="site">
      <header className="site-nav-wrap">
        <div className="site-nav">
          <Link to="/" aria-label="ApproveFlow home">
            <Brand />
          </Link>
          <span className="site-links" />
          <div className="site-nav-cta">
            <ThemeToggle />
            <Link className="link-quiet hide-mobile" to="/login">Log in</Link>
            <Link className="button button-primary" to="/signup">Start free</Link>
          </div>
        </div>
      </header>
      <main>
      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Pricing</span>
          <h2>Simple plans. Start free.</h2>
          <p>Try everything free, then pick the plan that fits. Cancel any time.</p>
        </div>
        <PlanCards
          headingLevel={2}
          action={(plan) => (
            <Link className={`button full ${plan.popular ? "button-primary" : "button-secondary"}`} to="/signup">
              Start free trial
            </Link>
          )}
        />
      </section>
      </main>
    </div>
  );
}
