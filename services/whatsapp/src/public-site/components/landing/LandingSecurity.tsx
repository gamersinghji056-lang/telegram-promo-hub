const controls = [
  "permission sets by role and action",
  "approval controls for outbound and sensitive operations",
  "activity logs with traceability",
  "business data separation across teams",
  "human oversight before release points",
];

export function LandingSecurity() {
  return (
    <section className="section">
      <div className="section-shell">
        <p className="section-kicker">Security &amp; Control</p>
        <h2>Built for teams that need confidence</h2>
        <ul className="checklist">
          {controls.map((item) => (
            <li key={item}>✓ {item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

