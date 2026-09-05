const agents = [
  {
    title: "Sales",
    items: ["Product qualification", "Lead response drafts", "Pipeline follow-up actions"],
  },
  {
    title: "Support",
    items: ["Issue triage", "Escalation context", "Response consistency checks"],
  },
  {
    title: "Operations",
    items: ["Order status flow", "Fulfilment tracking", "Internal coordination prompts"],
  },
];

export function LandingAiEmployees() {
  return (
    <section className="section">
      <div className="section-shell">
        <p className="section-kicker">AI Employees</p>
        <h2>Future-ready assistants, configured per role</h2>
        <p className="section-intro">
          Configure purpose, knowledge boundaries, permissions, language, and behavior for each agent.
        </p>
        <div className="agent-grid">
          {agents.map((agent) => (
            <article key={agent.title} className="panel panel-tight">
              <h3>{agent.title}</h3>
              <ul>
                {agent.items.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

