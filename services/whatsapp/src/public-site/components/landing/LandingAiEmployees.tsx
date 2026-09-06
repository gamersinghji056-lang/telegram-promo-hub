import { employeeRoles } from "../../config/landingContent";

export function LandingAiEmployees() {
  return (
    <section className="block">
      <div className="container">
        <div className="center-head">
          <div className="kicker">AI EMPLOYEES</div>
          <h2>Future business agents, configured for your workflow.</h2>
          <p>
            Configure purpose, knowledge, permissions, language behavior and operating boundaries for each agent.
          </p>
        </div>
        <div className="cards">
          {employeeRoles.map((agent) => (
            <article className="card3d tilt" key={agent.title}>
              <h3>{agent.title}</h3>
              <ul className="checklist">
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
