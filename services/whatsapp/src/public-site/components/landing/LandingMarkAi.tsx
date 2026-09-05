const markAiActions = [
  "summarize customer conversations",
  "prepare suggested replies",
  "search CRM records",
  "organize follow-ups",
  "process uploaded documents",
  "prepare business actions for review",
];

export function LandingMarkAi() {
  return (
    <section className="section">
      <div className="section-shell">
        <p className="section-kicker">MARK AI</p>
        <h2>An operator, not just a chatbot</h2>
        <p className="section-intro">
          MARK works as a structured team layer that helps agents stay accurate, consistent, and
          fast without replacing people.
        </p>
        <ul className="checklist">
          {markAiActions.map((item) => (
            <li key={item}>⚙ {item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

