export function LandingAbout() {
  return (
    <section className="block" id="about">
      <div className="container">
        <div className="center-head">
          <div className="kicker">ABOUT WA MARK</div>
          <h2 className="section-title">A complete operating workspace for WhatsApp Business.</h2>
          <p>
            WA MARK is designed for teams that need more than a chatbot. It combines conversation context, customer
            memory, AI assistance, campaigns, automations, files, web tasks and reporting in one workflow.
          </p>
        </div>
        <div className="cards">
          <article className="card3d tilt">
            <div className="card-icon">◈</div>
            <h3>One Business Inbox</h3>
            <p>Bring every customer thread into one workspace with ownership and follow-up continuity.</p>
          </article>
          <article className="card3d tilt">
            <div className="card-icon">✦</div>
            <h3>AI Business Operator</h3>
            <p>Use MARK AI and AI employees as team assistants, not replacements.</p>
          </article>
          <article className="card3d tilt">
            <div className="card-icon">⚙</div>
            <h3>Team Operations</h3>
            <p>Coordinate campaigns, automations, files and actions with clear permissions and oversight.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
