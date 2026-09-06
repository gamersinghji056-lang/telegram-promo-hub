const activity = [
  ["â—‰","New lead qualified","Priya Sharma moved to Qualified","2 min ago"],
  ["âœ¦","MARK AI summary ready","18 conversations summarized","8 min ago"],
  ["â—‡","Campaign completed","September Follow-up Â· 96.8% delivered","24 min ago"],
  ["âŒ˜","Sales Agent finished tasks","16 follow-ups completed","41 min ago"],
];

export function AppShellPage() {
  return (
    <div className="wm-dashboard">
      <section className="wm-welcome">
        <div><span className="eyebrow">WORKSPACE OVERVIEW</span><h1>Good morning, Admin.</h1><p>Hereâ€™s what is happening across your WhatsApp operation today.</p></div>
        <div className="wm-welcome-actions"><button className="wm-soft-btn">â†— Import contacts</button><button className="wm-primary-btn">ï¼‹ New campaign</button></div>
      </section>

      <section className="wm-status-banner">
        <div><span className="wm-status-icon">â—‰</span><div><b>Connect WhatsApp Business</b><p>Link your Meta WhatsApp Business account to start receiving real conversations.</p></div></div>
        <button>Connect account â†’</button>
      </section>

      <section className="wm-kpis">
        <article><span className="wm-kpi-icon purple">â—‰</span><div><small>Total messages</small><b>18,429</b><em>â†‘ 12.4% this week</em></div></article>
        <article><span className="wm-kpi-icon blue">â—‡</span><div><small>Delivery rate</small><b>96.8%</b><em>â†‘ 1.8% this week</em></div></article>
        <article><span className="wm-kpi-icon violet">â™¢</span><div><small>Active leads</small><b>742</b><em>â†‘ 38 new today</em></div></article>
        <article><span className="wm-kpi-icon cyan">âœ¦</span><div><small>AI actions</small><b>1,284</b><em>â†‘ 23.1% this week</em></div></article>
      </section>

      <section className="wm-grid-main">
        <article className="wm-card wm-chart-card">
          <div className="wm-card-head"><div><span className="eyebrow">ACTIVITY</span><h3>Message activity</h3></div><select defaultValue="7"><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></div>
          <div className="wm-chart-legend"><span><i className="sent" />Sent</span><span><i className="read" />Read</span></div>
          <div className="wm-chart-area">
            <div className="wm-ylabels"><span>4K</span><span>3K</span><span>2K</span><span>1K</span><span>0</span></div>
            <svg viewBox="0 0 700 220" preserveAspectRatio="none" aria-label="Message activity chart">
              <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7134d8" stopOpacity=".25"/><stop offset="100%" stopColor="#7134d8" stopOpacity="0"/></linearGradient></defs>
              <path className="wm-area" d="M0 175 C60 145,85 155,130 120 S220 145,275 95 S360 120,410 70 S500 105,555 55 S640 80,700 30 L700 220 L0 220Z"/>
              <path className="wm-line-primary" d="M0 175 C60 145,85 155,130 120 S220 145,275 95 S360 120,410 70 S500 105,555 55 S640 80,700 30"/>
              <path className="wm-line-secondary" d="M0 190 C60 170,90 180,135 145 S220 165,280 125 S360 145,415 105 S500 125,560 90 S645 105,700 65"/>
            </svg>
            <div className="wm-xlabels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
          </div>
        </article>

        <article className="wm-card wm-ai-card">
          <div className="wm-card-head"><div><span className="eyebrow">INTELLIGENCE</span><h3>MARK AI</h3></div><span className="wm-live">â— LIVE</span></div>
          <div className="wm-ai-orb">âœ¦</div>
          <h4>23 conversations need attention.</h4>
          <p>8 qualified leads are ready for follow-up. 3 conversations have unresolved questions.</p>
          <button className="wm-primary-btn">Open MARK AI â†’</button>
        </article>
      </section>

      <section className="wm-grid-bottom">
        <article className="wm-card">
          <div className="wm-card-head"><div><span className="eyebrow">RECENT</span><h3>Campaigns</h3></div><button className="wm-link-btn">View all â†’</button></div>
          <div className="wm-table">
            <div className="wm-table-row head"><span>Campaign</span><span>Status</span><span>Sent</span><span>Read</span></div>
            <div className="wm-table-row"><span><b>September Follow-up</b><small>Today, 10:30 AM</small></span><span><em className="status done">Completed</em></span><span>4,820</span><span>81.2%</span></div>
            <div className="wm-table-row"><span><b>New Customer Welcome</b><small>Yesterday</small></span><span><em className="status live">Running</em></span><span>2,140</span><span>76.4%</span></div>
            <div className="wm-table-row"><span><b>Product Update</b><small>Sep 4</small></span><span><em className="status draft">Draft</em></span><span>â€”</span><span>â€”</span></div>
          </div>
        </article>

        <article className="wm-card">
          <div className="wm-card-head"><div><span className="eyebrow">WORKSPACE</span><h3>Quick actions</h3></div></div>
          <div className="wm-quick-actions"><button><i>â—‡</i><span><b>Start campaign</b><small>Reach approved contacts</small></span></button><button><i>â—Ž</i><span><b>Add contact</b><small>Create a CRM profile</small></span></button><button><i>âŒ˜</i><span><b>AI employee</b><small>Create a specialist agent</small></span></button><button><i>âš™</i><span><b>Automation</b><small>Build a workflow</small></span></button></div>
        </article>

        <article className="wm-card wm-activity-card">
          <div className="wm-card-head"><div><span className="eyebrow">LIVE</span><h3>Recent activity</h3></div></div>
          <div className="wm-activity-list">{activity.map(([icon,title,body,time]) => <div className="wm-activity" key={title}><i>{icon}</i><div><b>{title}</b><span>{body}</span></div><small>{time}</small></div>)}</div>
        </article>
      </section>
    </div>
  );
}