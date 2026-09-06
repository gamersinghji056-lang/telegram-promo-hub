import { webTaskHighlights } from "../../config/landingContent";

export function LandingWebTasks() {
  return (
    <section className="block">
      <div className="container">
        <div className="center-head">
          <div className="kicker">WEB TASKS</div>
          <h2>Authorized business workflows beyond chat.</h2>
          <p>
            Execute routine website and portal tasks in support of operations while keeping boundaries and permissions visible.
          </p>
        </div>
        <div className="cards">
          {webTaskHighlights.map((item) => (
            <article className="card3d" key={item}>
              <h3>{item}</h3>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
