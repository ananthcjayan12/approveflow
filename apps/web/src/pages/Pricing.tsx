import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
import { PlanCards } from "../components/PlanCards";

export default function Pricing() {
  return (
    <div className="site">
      <header className="site-nav">
        <Link to="/">
          <Brand />
        </Link>
        <div className="site-nav-cta">
          <Link className="link-quiet" to="/login">
            Log in
          </Link>
          <Link className="button button-primary" to="/signup">
            Start free
          </Link>
        </div>
      </header>
      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Pricing</span>
          <h2>Simple plans. Start free.</h2>
          <p>Try everything free, then pick the plan that fits. Cancel any time.</p>
        </div>
        <PlanCards
          action={(plan) => (
            <Link
              className={`button full ${plan.popular ? "button-primary" : "button-secondary"}`}
              to="/signup"
            >
              Start free trial
            </Link>
          )}
        />
      </section>
    </div>
  );
}
