import { Link } from "react-router-dom";
import { supportCapabilities } from "../../config/landingContent";

export function LandingSupport() {
  return (
    <section className="block" id="support">
      <div className="container showcase">
        <div className="showgrid">
          <div className="copy">
            <div className="kicker">SUPPORT</div>
            <h2>Get help with setup, operations and AI configuration.</h2>
            <p>Support can help with onboarding, WhatsApp connectivity, team setup, campaigns, AI instructions and automations.</p>
            <div className="feature-list">
              {supportCapabilities.map((item) => (
                <div key={item}>
                  <b>•</b> {item}
                </div>
              ))}
            </div>
            <div className="hero-actions">
              <Link className="btn primary" to="/#support">
                Open Support →
              </Link>
            </div>
          </div>
          <div className="support-panel">
            <div className="support-bubble">
              <b>WA MARK Support</b>
              <span>Online</span>
              <p>Tell us what you are setting up and your support team can guide the next step.</p>
            </div>
            <div className="support-stat">
              <b>24/7</b>
              <span>Workspace assistance</span>
            </div>
            <div className="support-stat">
              <b>AI + Human</b>
              <span>Support model</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
