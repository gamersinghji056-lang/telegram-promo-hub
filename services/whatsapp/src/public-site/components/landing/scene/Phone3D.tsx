export function Phone3D() {
  return (
    <div className="phone3d" data-parallax-depth="24" data-parallax-base="rotateX(-4deg)" data-parallax-rotate-x="0.7" data-parallax-rotate-y="0.5">
      <div className="phone-glass">
        <div className="phone-header">
          <span>WA MARK</span>
          <small>AI Assistant</small>
        </div>
        <div className="phone-status">
          <span className="status-dot" />
          <span>Online</span>
        </div>
        <div className="phone-thread">
          <article className="pill from-mark">
            <strong>MARK AI</strong>
            <p>Campaign is paused pending approval.</p>
          </article>
          <article className="pill">
            <strong>Smart Replies</strong>
            <p>Drafted response prepared for lead follow-up.</p>
          </article>
          <article className="pill from-mark">
            <strong>Campaign</strong>
            <p>Broadcast active in sandbox mode.</p>
          </article>
        </div>
        <div className="phone-metrics">
          <div>
            <p>Auto Reply</p>
            <b>Ready</b>
          </div>
          <div>
            <p>Files</p>
            <b>14 ready</b>
          </div>
        </div>
      </div>
    </div>
  );
}
