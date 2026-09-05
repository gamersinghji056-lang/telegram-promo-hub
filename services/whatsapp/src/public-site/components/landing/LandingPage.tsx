import { Link } from "react-router-dom";
import { LandingDownloadCta } from "./LandingDownloadCta";
import { LandingFilesMedia } from "./LandingFilesMedia";
import { LandingFooter } from "./LandingFooter";
import { LandingHero } from "./LandingHero";
import { LandingMarkAi } from "./LandingMarkAi";
import { LandingAnalytics } from "./LandingAnalytics";
import { LandingAiEmployees } from "./LandingAiEmployees";
import { LandingLanguages } from "./LandingLanguages";
import { LandingOperations } from "./LandingOperations";
import { LandingPreview } from "./LandingPreview";
import { LandingCapabilities } from "./LandingCapabilities";
import { LandingSecurity } from "./LandingSecurity";
import { LandingWebTasks } from "./LandingWebTasks";

export function LandingPage() {
  return (
    <div className="landing-page">
      <LandingHero />
      <LandingPreview />
      <LandingCapabilities />
      <LandingMarkAi />
      <LandingAiEmployees />
      <LandingOperations />
      <LandingFilesMedia />
      <LandingWebTasks />
      <LandingAnalytics />
      <LandingSecurity />
      <LandingLanguages />
      <LandingDownloadCta />
      <section className="section final-cta-section">
        <div className="section-shell">
          <p className="section-kicker">Operational Readiness</p>
          <h2>Put MARK to work for your business</h2>
          <div className="cta-group">
            <Link className="btn btn-primary" to="/register">
              Get Started
            </Link>
            <Link className="btn btn-secondary" to="/features">
              Explore Features
            </Link>
          </div>
        </div>
      </section>
      <LandingFooter />
    </div>
  );
}

