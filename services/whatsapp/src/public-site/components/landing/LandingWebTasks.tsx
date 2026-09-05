const webTasks = [
  "checking supplier portals",
  "gathering public business information",
  "updating supported systems",
  "retrieving business data into handoff notes",
];

export function LandingWebTasks() {
  return (
    <section className="section">
      <div className="section-shell">
        <p className="section-kicker">Web Tasks</p>
        <h2>Authorized browser workflows for business operations</h2>
        <ul className="checklist">
          {webTasks.map((item) => (
            <li key={item}>▹ {item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

