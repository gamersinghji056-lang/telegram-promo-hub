export function LandingPreview() {
  return (
    <section className="section preview">
      <div className="section-shell">
        <p className="section-kicker">Product Preview</p>
        <h2>Single workspace for operations</h2>
        <p className="section-intro">
          Designed for teams that handle customer conversations and operations every day.
        </p>

        <div className="dashboard-preview" aria-label="MARK workspace preview">
          <aside className="preview-sidebar">
            <h3>Inbox</h3>
            <ul>
              <li className="active">
                <span className="line-pill" />
                <div>
                  <strong>Acme Logistics</strong>
                  <small>3 unread messages</small>
                </div>
              </li>
              <li>
                <span className="line-pill line-pill--muted" />
                <div>
                  <strong>Cloudline Interiors</strong>
                  <small>Follow-up due in 2h</small>
                </div>
              </li>
              <li>
                <span className="line-pill line-pill--muted" />
                <div>
                  <strong>Northline Services</strong>
                  <small>Quote sent</small>
                </div>
              </li>
            </ul>
          </aside>

          <section className="preview-workspace">
            <header>
              <div>
                <h3>MARK AI Assistant</h3>
                <p>Summarized thread: “Customer requested pricing update and invoice status.”</p>
              </div>
              <span className="status-pill">Permission: Controlled</span>
            </header>
            <div className="chat-mock">
              <article>
                <p>Hello, we can prepare today&apos;s shipment schedule and draft a follow-up.</p>
              </article>
              <article className="system-message">
                <p>AI suggestion prepared and awaiting approval.</p>
              </article>
            </div>
            <footer>
              <div className="preview-stats">
                <div>
                  <span>Customer Profile</span>
                  <strong>Enterprise + 14 tags</strong>
                </div>
                <div>
                  <span>Automation</span>
                  <strong>Lead routing active</strong>
                </div>
                <div>
                  <span>Activity</span>
                  <strong>12 events this hour</strong>
                </div>
              </div>
            </footer>
          </section>
        </div>
      </div>
    </section>
  );
}

