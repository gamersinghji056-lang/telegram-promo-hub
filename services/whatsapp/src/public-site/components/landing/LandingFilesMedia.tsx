import { filesMediaHighlights } from "../../config/landingContent";

export function LandingFilesMedia() {
  return (
    <section className="block" id="files">
      <div className="container">
        <div className="center-head">
          <div className="kicker">FILES &amp; MEDIA</div>
          <h2>Process and serve business content safely.</h2>
        </div>
        <div className="cards">
          {filesMediaHighlights.map((item) => (
            <article className="card3d" key={item}>
              <div className="card-icon">📄</div>
              <p>{item}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
