import { capabilities, dashboardCards } from "../../config/landingContent";

export function LandingCapabilities() {
  return (
    <section className="block" id="features">
      <div className="container">
        <div className="center-head">
          <div className="kicker">ONE WORKSPACE · MANY CAPABILITIES</div>
          <h2>Designed like a product from the future.</h2>
          <p>Every layer of WA MARK is built to connect conversation context, automation, AI assistance and team decisions.</p>
        </div>
        <div className="cards cards-3x3">
          {capabilities.map((capability, index) => (
            <article className="card3d tilt" key={capability.title}>
              <span className="mini">{`0${index + 1} / ${capability.title.toUpperCase()}`}</span>
            <div className="card-icon">•</div>
              <h3>{capability.title}</h3>
              <p>{capability.body}</p>
            </article>
          ))}
        </div>
        <div className="dashboard-strip" aria-label="Operations cards">
          {dashboardCards.map((tile) => (
            <article className="dash-mini" key={tile.title}>
              <div className="dmicon">{tile.icon}</div>
              <b>{tile.title}</b>
              <span>Live in workspace panel</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
