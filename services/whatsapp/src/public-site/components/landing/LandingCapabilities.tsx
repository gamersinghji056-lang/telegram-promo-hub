const coreCapabilities = [
  { name: "AI Business Assistant", description: "Summaries, response suggestions, and context-aware recommendations for operators." },
  { name: "Smart Inbox", description: "Unified WhatsApp workspace with follow-up reminders and status tracking." },
  { name: "Contacts & CRM", description: "Customer dossiers with tags, interaction history, and notes." },
  { name: "Campaigns", description: "Pre-approved outbound campaigns with structured review before dispatch." },
  { name: "AI Employees", description: "Specialized agents for sales, support, and operations routines." },
  { name: "Automations", description: "Rule-based flows for repetitive tasks and handoffs between team members." },
  { name: "Media & Files", description: "Shared storage, document workflows, and structured media handling." },
  { name: "Web Tasks", description: "Authorized browser workflows for routine partner and business operations." },
];

export function LandingCapabilities() {
  return (
    <section className="section">
      <div className="section-shell">
        <p className="section-kicker">Core Capabilities</p>
        <h2>Everything your team needs to stay operating</h2>
        <div className="capability-grid">
          {coreCapabilities.map((capability) => (
            <article key={capability.name} className="panel">
              <h3>{capability.name}</h3>
              <p>{capability.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

