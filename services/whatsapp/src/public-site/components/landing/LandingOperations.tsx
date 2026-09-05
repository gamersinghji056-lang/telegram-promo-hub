const operationsItems = [
  "customer conversations with context and handoff notes",
  "template support for structured messaging",
  "approved campaigns and clear dispatch windows",
  "follow-ups with reminders and outcomes",
  "contact and label organization",
  "human handoff controls at any step",
];

export function LandingOperations() {
  return (
    <section className="section">
      <div className="section-shell">
        <p className="section-kicker">WhatsApp Business Operations</p>
        <h2>Built for compliant, human-led operations</h2>
        <p className="section-intro">
          MARK keeps operations structured: every outbound touch point and campaign action is clearly
          controlled in one place.
        </p>
        <ul className="checklist">
          {operationsItems.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

