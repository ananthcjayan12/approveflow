import { Link } from "react-router-dom";
import { Brand } from "../components/Brand";
export default function Pricing() {
  return (
    <div className="standalone-pricing">
      <header>
        <Brand />
        <Link to="/">Back home</Link>
      </header>
      <div className="page-pad">
        <h1>Start with a free trial.</h1>
        <p>
          Create your workspace and try client approvals before choosing a paid
          plan.
        </p>
        <div className="plan-grid">
          {[
            ["Solo", "₹599", "10 GB"],
            ["Freelancer", "₹999", "50 GB"],
            ["Agency", "₹1,599", "150 GB"],
          ].map(([name, price, storage]) => (
            <article className="plan-card" key={name}>
              <h2>{name}</h2>
              <h3>{price}/month</h3>
              <p>{storage} included storage</p>
              <Link className="button button-primary" to="/signup">
                Start trial
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
