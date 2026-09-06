import { Link } from "react-router-dom";
import { heroStats, trustedBrands } from "../../config/landingContent";
import { ProductScene } from "./scene/ProductScene";

export function LandingHero() {
  return (
    <>
      <section className="hero" id="top">
        <div className="container hero-grid">
          <div>
            <div className="badge"><i /> A NEW OPERATING LAYER FOR WHATSAPP BUSINESS</div>
            <h1>Turn every conversation into <span className="gradient">organized action.</span></h1>
            <p>
              WA MARK brings customer conversations, CRM, AI employees, campaigns, automations, files, web tasks and analytics into one intelligent workspace — designed to help teams move faster without losing human control.
            </p>
            <div className="hero-actions">
              <Link className="btn primary" to="/register">Enter WA MARK →</Link>
              <Link className="btn" to="/#product">Explore the workspace</Link>
            </div>
            <div className="hero-note">
              <span>✦ AI + human approval</span>
              <span>✦ Team-ready</span>
              <span>✦ Built for real operations</span>
            </div>
            <div className="hero-quick-strip">
              {heroStats.map((stat, index) => (
                <div className="hero-quick" key={stat.label}>
                  <i>{["♟", "▥", "◈", "ϟ"][index] ?? "✦"}</i>
                  <b>{stat.value}</b>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
          <ProductScene />
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="track">
          {["SMART INBOX", "MARK AI", "AI EMPLOYEES", "AUTOMATIONS", "CAMPAIGNS", "CRM", "FILES", "WEB TASKS", "ANALYTICS", "SMART INBOX", "MARK AI", "AI EMPLOYEES", "AUTOMATIONS", "CAMPAIGNS", "CRM", "FILES", "WEB TASKS", "ANALYTICS"].map((item, index) => (
            <span key={`${item}-${index}`}>{item}</span>
          ))}
        </div>
      </div>

      <div className="trusted-strip">
        <div className="container trusted-inner">
          <span className="trusted-label">Trusted infrastructure & integrations</span>
          {trustedBrands.map((brand) => <span className="trusted-brand" key={brand}>{brand}</span>)}
        </div>
      </div>
    </>
  );
}

