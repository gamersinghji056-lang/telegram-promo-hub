import { languageList } from "../../config/landingContent";

export function LandingLanguages() {
  return (
    <section className="block" id="language">
      <div className="container">
        <div className="center-head">
          <div className="kicker">MULTI-LANGUAGE</div>
          <h2>Communicate in more languages across regions.</h2>
          <p>MARK keeps context continuity while operating with multilingual customer communication.</p>
          <div className="language-cloud">
            {languageList.map((language) => (
              <span key={language} className="language-chip">
                {language}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
