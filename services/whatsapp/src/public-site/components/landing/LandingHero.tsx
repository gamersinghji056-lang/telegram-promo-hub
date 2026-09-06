import { Link } from "react-router-dom";
import { heroStats, trustedBrands } from "../../config/landingContent";
import { ProductScene } from "./scene/ProductScene";

export function LandingHero() {
  return (
    <section className="hero block" id="top">
      <div className="container hero-grid">
        <article>
          <p className="badge"><span className="badge-dot" /> A premium operating layer for WhatsApp Business</p>
          <h1 className="hero-title">
            Smarter WhatsApp Business <span className="gradient">with WA MARK</span>
          </h1>
          <p>
            WA MARK connects conversations, customers, campaigns, AI employees, automations, files, web tasks and
            analytics in one intelligent workspace so teams can stay responsive without losing control.
          </p>
          <div className="hero-actions">
            <Link className="btn primary" to="/register">
              Get Started
            </Link>
            <Link className="btn" to="/download">
              Download App
            </Link>
            <Link className="hero-link" to="/#features">
              View Features
            </Link>
          </div>
          <div className="hero-note">
            <span>• AI + human approval</span>
            <span>• Team-ready operations</span>
            <span>• Built for real work</span>
          </div>
          <div className="hero-quick-strip" aria-label="MARK success metrics">
            {heroStats.map((stat) => (
              <div className="hero-quick" key={stat.label}>
                <i>✓</i>
                <b>{stat.value}</b>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </article>

        <ProductScene />
      </div>
      <div className="trusted-strip trusted-strip-hero" aria-label="integrations">
        <div className="container trusted-inner">
          <span className="trusted-label">Trusted infrastructure & integrations</span>
          {trustedBrands.map((brand) => (
            <span className="trusted-brand" key={brand}>
              {brand}
            </span>
          ))}
        </div>
      </div>
      <div className="marquee" aria-hidden="true">
        <div className="track">
          <span>SMART INBOX</span>
          <span>MARK AI</span>
          <span>AI EMPLOYEES</span>
          <span>AUTOMATIONS</span>
          <span>CAMPAIGNS</span>
          <span>CRM</span>
          <span>FILES</span>
          <span>WEB TASKS</span>
          <span>ANALYTICS</span>
          <span>SMART INBOX</span>
          <span>MARK AI</span>
          <span>AI EMPLOYEES</span>
          <span>AUTOMATIONS</span>
          <span>CAMPAIGNS</span>
          <span>CRM</span>
          <span>FILES</span>
          <span>WEB TASKS</span>
          <span>ANALYTICS</span>
        </div>
      </div>
    </section>
  );
}
