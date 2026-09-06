const bars = [38, 55, 43, 68, 60, 82, 74, 94, 78];

export function Laptop3D() {
  return (
    <div className="main-window">
      <div className="window-top"><i className="dot" /><i className="dot" /><i className="dot" /><div className="search" /></div>
      <div className="app-body">
        <aside className="side">
          <div className="side-title">Workspace</div>
          <div className="side-item active">◈ Dashboard</div>
          <div className="side-item">◉ Inbox</div>
          <div className="side-item">◎ Contacts</div>
          <div className="side-title">Intelligence</div>
          <div className="side-item">✦ MARK AI</div>
          <div className="side-item">⌘ AI Employees</div>
          <div className="side-item">⚙ Automations</div>
          <div className="side-title">Growth</div>
          <div className="side-item">◇ Campaigns</div>
          <div className="side-item">▥ Analytics</div>
        </aside>
        <div className="content">
          <div className="toprow">
            <div><div className="title-small">Good morning, Admin</div><div className="sub-small">Here’s what is happening across your workspace.</div></div>
            <div className="badge v6-live-badge">LIVE</div>
          </div>
          <div className="metrics">
            <div className="metric"><b>18.4K</b><span>Total messages</span></div>
            <div className="metric"><b>96.8%</b><span>Delivered</span></div>
            <div className="metric"><b>81.2%</b><span>Read</span></div>
            <div className="metric"><b>742</b><span>Active leads</span></div>
          </div>
          <div className="chartrow">
            <div className="chart"><h4>Message Activity</h4><div className="bars">{bars.map((bar, i) => <i className="bar" key={i} style={{ height: `${bar}%` }} />)}</div></div>
            <div className="assist"><h4>MARK AI</h4><div className="ai-orb" /><p>23 conversations need attention. 8 qualified leads are ready for follow-up.</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}

