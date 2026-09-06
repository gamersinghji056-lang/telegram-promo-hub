import { Link } from "react-router-dom";
import { downloadMetadata } from "../../config/landingContent";

export function LandingDownloadCta() {
  return (
    <section className="block" id="download">
      <div className="container">
        <div className="center-head">
          <div className="kicker">GET STARTED</div>
          <h2>Download MARK where your team works.</h2>
          <p>Web access is live now. Android, Windows, and iOS packages are queued in rollout.</p>
        </div>
        <div className="cards download-grid">
          {downloadMetadata.map((entry) => (
            <article className="card3d" key={entry.platform}>
              <h3>{entry.platform}</h3>
              <p>{entry.description}</p>
              <span className={`status-badge status-${entry.status}`}>{entry.status}</span>
            </article>
          ))}
        </div>
        <div className="cta-group">
          <Link className="btn primary" to="/register">
            Get Started
          </Link>
          <Link className="btn" to="/download">
            Explore Downloads
          </Link>
        </div>
      </div>
    </section>
  );
}
