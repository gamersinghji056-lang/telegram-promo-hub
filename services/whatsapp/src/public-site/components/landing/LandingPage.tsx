import { Link } from "react-router-dom";
import { LandingAbout } from "./LandingAbout";
import { LandingDownloadCta } from "./LandingDownloadCta";
import { LandingFilesMedia } from "./LandingFilesMedia";
import { LandingFooter } from "./LandingFooter";
import { LandingHero } from "./LandingHero";
import { LandingMarkAi } from "./LandingMarkAi";
import { LandingAnalytics } from "./LandingAnalytics";
import { LandingFaq } from "./LandingFAQ";
import { LandingAiEmployees } from "./LandingAiEmployees";
import { LandingLanguages } from "./LandingLanguages";
import { LandingHowToUse } from "./LandingHowToUse";
import { LandingOperations } from "./LandingOperations";
import { LandingCapabilities } from "./LandingCapabilities";
import { LandingPricing } from "./LandingPricing";
import { LandingSecurity } from "./LandingSecurity";
import { LandingSupport } from "./LandingSupport";
import { LandingParallax } from "./scene/ParallaxField";
import { Mark8Infinity } from "./scene/Mark8Infinity";
import { LandingWebTasks } from "./LandingWebTasks";

export function LandingPage() {
  return (
    <div className="landing-root">
      <LandingParallax />
      <Mark8Infinity />
      <div className="cursor-ambient c-a1" data-ambient-depth="16" />
      <div className="cursor-ambient c-a2" data-ambient-depth="28" />
      <div className="cursor-ambient c-a3" data-ambient-depth="40" />
      <LandingHero />
      <LandingCapabilities />
      <LandingMarkAi />
      <LandingAiEmployees />
      <LandingOperations />
      <LandingFilesMedia />
      <LandingWebTasks />
      <LandingAnalytics />
      <LandingAbout />
      <LandingHowToUse />
      <LandingPricing />
      <LandingFaq />
      <LandingSupport />
      <LandingSecurity />
      <LandingLanguages />
      <section className="cta">
        <div className="container ctabox">
          <div>
            <div className="kicker">WA MARK</div>
            <h2>One workspace. One customer story. One intelligent operating layer.</h2>
            <p>
              Bring conversations, CRM, AI employees, automations, campaigns, files and analytics into one premium business workspace.
            </p>
            <div className="hero-actions" style={{ justifyContent: "center" }}>
              <Link className="btn primary" to="/register">
                Get Started â†’
              </Link>
              <Link className="btn" to="/#features">
                Explore Features
              </Link>
            </div>
          </div>
        </div>
      </section>
      <LandingDownloadCta />
      <LandingFooter />
    </div>
  );
}

