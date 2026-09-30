import { ReactNode } from "react";
import { Check } from "lucide-react";

export const plans = [
  { key: "solo", name: "Solo", price: "₹599", storage: "10 GB", for: "Freelancers with a few clients" },
  { key: "freelancer", name: "Freelancer", price: "₹999", storage: "50 GB", for: "Busy freelancers & small teams", popular: true },
  { key: "agency", name: "Agency", price: "₹1,599", storage: "150 GB", for: "Agencies with lots of video" },
];

export function PlanCards({ action }: { action: (plan: (typeof plans)[number]) => ReactNode }) {
  return (
    <div className="plan-grid">
      {plans.map((plan) => (
        <article key={plan.key} className={`plan-card ${plan.popular ? "popular" : ""}`}>
          {plan.popular && <span className="plan-flag">Most popular</span>}
          <h3>{plan.name}</h3>
          <p className="muted">{plan.for}</p>
          <div className="price">
            {plan.price}
            <span>/month</span>
          </div>
          <ul className="checks">
            <li><Check size={16} /> {plan.storage} storage</li>
            <li><Check size={16} /> Unlimited clients & projects</li>
            <li><Check size={16} /> Image pins & video comments</li>
            <li><Check size={16} /> Clients never need a login</li>
          </ul>
          {action(plan)}
        </article>
      ))}
    </div>
  );
}
