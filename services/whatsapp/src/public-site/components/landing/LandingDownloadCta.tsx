import { Link } from "react-router-dom";
import { downloadCatalog, type DownloadStatus } from "../../../config/downloads";

const labelByStatus: Record<DownloadStatus, string> = {
  available: "Available",
  "coming-soon": "Coming Soon",
};

export function LandingDownloadCta() {
  return (
    <section className="section">
      <div className="section-shell">
        <p className="section-kicker">Download</p>
        <h2>Get MARK on your team</h2>
        <p className="section-intro">
          Start with the web app today and plan Android, Windows, and iOS releases in the rollout
          roadmap.
        </p>
        <div className="download-matrix">
          {downloadCatalog.map((entry) => (
            <article key={entry.id} className="panel panel-tight">
              <h3>{entry.title}</h3>
              <p>{entry.description}</p>
              <small className={`status-badge status-${entry.status}`}>{labelByStatus[entry.status]}</small>
            </article>
          ))}
        </div>
        <Link className="btn btn-primary" to="/download">
          Explore Download Options
        </Link>
      </div>
    </section>
  );
}
