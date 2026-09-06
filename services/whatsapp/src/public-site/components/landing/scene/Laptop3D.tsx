const metricValues = [
  { title: "Total Conversations", value: "18.4K" },
  { title: "Delivered", value: "96.8%" },
  { title: "Read", value: "81.2%" },
  { title: "Active Leads", value: "742" },
];

const bars = [38, 55, 43, 68, 60, 82, 74, 94, 78];

export function Laptop3D() {
  return (
    <div className="main-window" data-parallax-depth="12" data-parallax-base="translateZ(25px)" data-parallax-rotate-x="1.8" data-parallax-rotate-y="1.2">
      <div className="window-top">
        <i className="dot" />
        <i className="dot" />
        <i className="dot" />
        <div className="search" />
      </div>
      <div className="app-body">
        <aside className="side">
          <div className="side-title">Workspace</div>
          <div className="side-item active">● Dashboard</div>
          <div className="side-item">◉ Inbox</div>
          <div className="side-item">◈ Contacts</div>
          <div className="side-title">Intelligence</div>
          <div className="side-item">✦ MARK AI</div>
          <div className="side-item">◉ AI Employees</div>
          <div className="side-item">⚙ Automations</div>
          <div className="side-title">Growth</div>
          <div className="side-item">▦ Campaigns</div>
          <div className="side-item">↗ Analytics</div>
        </aside>
        <div className="content">
          <header className="toprow">
            <div>
              <div className="title-small">Good morning, Operations</div>
              <div className="sub-small">Here&apos;s what is happening across your workspace.</div>
            </div>
            <div className="badge badge-mini">LIVE</div>
          </header>
          <div className="metrics">
            {metricValues.map((metric) => (
              <div className="metric" key={metric.title}>
                <b>{metric.value}</b>
                <span>{metric.title}</span>
              </div>
            ))}
          </div>
          <div className="chartrow">
            <div className="chart">
              <h4>Message Activity</h4>
              <div className="bars">
                {bars.map((bar) => (
                  <i className="bar" key={bar} style={{ height: `${bar}%` }} />
                ))}
              </div>
            </div>
            <div className="assist">
              <h4>MARK AI</h4>
              <div className="ai-orb" />
              <p>23 conversations need attention. 8 qualified leads are ready for follow-up.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
