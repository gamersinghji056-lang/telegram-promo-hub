import { operationsHighlights } from "../../config/landingContent";

export function LandingOperations() {
  return (
    <section className="block">
      <div className="container">
        <div className="center-head">
          <div className="kicker">WHATSAPP BUSINESS OPERATIONS</div>
          <h2>Built for compliant, human-led operations.</h2>
          <p>
            WA MARK keeps operations structured: every outbound touch point, campaign action and handoff is clear and traceable.
          </p>
        </div>
        <div className="dashboard-strip" aria-label="workflow sequence">
          <article className="dash-mini">
            <div className="dmicon">◎</div>
            <b>1. Connect</b>
            <span>Connect your WhatsApp workspace</span>
          </article>
          <article className="dash-mini">
            <div className="dmicon">◻</div>
            <b>2. Configure</b>
            <span>Define templates and automations</span>
          </article>
          <article className="dash-mini">
            <div className="dmicon">◆</div>
            <b>3. Launch</b>
            <span>Start approved flows and campaigns</span>
          </article>
          <article className="dash-mini">
            <div className="dmicon">↗</div>
            <b>4. Grow</b>
            <span>Improve through dashboards and outcomes</span>
          </article>
        </div>
        <div className="cards">
          {operationsHighlights.map((item) => (
            <article className="card3d tilt" key={item}>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
