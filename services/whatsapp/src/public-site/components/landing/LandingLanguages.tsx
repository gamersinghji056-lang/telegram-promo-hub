const languages = ["English", "Spanish", "Arabic", "Portuguese", "Hindi", "French"];

export function LandingLanguages() {
  return (
    <section className="section">
      <div className="section-shell">
        <p className="section-kicker">Multi-Language</p>
        <h2>Communicate with customers in more than one language</h2>
        <p className="section-intro">
          MARK supports multilingual customer communication and context continuity for global teams.
        </p>
        <div className="language-cloud">
          {languages.map((language) => (
            <span key={language} className="language-chip">
              {language}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

