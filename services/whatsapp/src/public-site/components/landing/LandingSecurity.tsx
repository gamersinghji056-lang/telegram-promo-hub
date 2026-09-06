import { securityControls } from "../../config/landingContent";

export function LandingSecurity() {
  return (
    <section className="block" id="security">
      <div className="container">
        <div className="center-head">
          <div className="kicker">CONTROL IS PART OF THE DESIGN</div>
          <h2>Automation without losing responsibility.</h2>
          <p>Teams decide who can access what, where AI can act, and where human approval is required.</p>
        </div>
        <div className="cards">
          {securityControls.map((item) => (
            <article className="card3d tilt" key={item}>
              <div className="card-icon">🔐</div>
              <h3>Security Control</h3>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
