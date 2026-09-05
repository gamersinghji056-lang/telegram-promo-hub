const fileActions = [
  "PDFs and agreements with shared indexing",
  "images and media with clear labeling",
  "documents in structured customer workflows",
  "media sending controls in chat threads",
  "document processing queue and status",
  "image resize and compression tooling",
];

export function LandingFilesMedia() {
  return (
    <section className="section">
      <div className="section-shell">
        <p className="section-kicker">Files &amp; Media</p>
        <h2>Store, prepare, and share safely</h2>
        <div className="media-grid">
          {fileActions.map((item) => (
            <article key={item} className="panel panel-tight">
              <p>{item}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

