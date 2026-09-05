import { Link } from "react-router-dom";
import { productConfig } from "../../../config/product";

export function LandingHero() {
  return (
    <section className="section hero">
      <div className="section-shell">
        <p className="section-kicker">MARK WhatsApp</p>
        <h1>Your AI Business Operator for WhatsApp</h1>
        <p>
          MARK helps teams manage conversations, customers, follow-ups, files, AI employees,
          workflows, and daily operations from one intelligent workspace.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" to="/register">
            Get Started
          </Link>
          <Link className="btn btn-secondary" to="/download">
            Download App
          </Link>
          <Link className="link-action" to="/features">
            View Features
          </Link>
        </div>
        <p className="hero-subline">{productConfig.domain}</p>
      </div>
    </section>
  );
}
