type DashboardIconName="message"|"delivery"|"lead"|"ai"|"campaign"|"contact"|"employee"|"automation";

function DashboardIcon({name}:{name:DashboardIconName}){
  const p={
    message:<><path d="M4 5h16v12H9l-5 4V5z"/><path d="M8 9h8M8 13h5"/></>,
    delivery:<><path d="M4 12l5 5L20 6"/><path d="M14 6h6v6"/></>,
    lead:<><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6"/></>,
    ai:<><path d="M12 2l1.7 5.2L19 9l-5.3 1.8L12 16l-1.7-5.2L5 9l5.3-1.8L12 2z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/></>,
    campaign:<><path d="M4 12l11-5v10L4 12z"/><path d="M15 10h4a2 2 0 0 1 0 4h-4"/><path d="M7 14l1.5 5"/></>,
    contact:<><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6"/></>,
    employee:<><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.6-4 2.6-6 6-6s5.4 2 6 6"/><path d="M14 15c3.8-.7 6.2 1 7 5"/></>,
    automation:<><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></>
  }[name];
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{p}</svg>;
}

const activity:Array<[DashboardIconName,string,string,string]>=[
  ["lead","New lead qualified","Priya Sharma moved to Qualified","2 min ago"],
  ["ai","MARK AI summary ready","18 conversations summarized","8 min ago"],
  ["campaign","Campaign completed","September Follow-up - 96.8% delivered","24 min ago"],
  ["employee","Sales Agent finished tasks","16 follow-ups completed","41 min ago"]
];

export function AppShellPage(){
  return <div className="wm-dashboard">
    <section className="wm-welcome"><div><span className="eyebrow">WORKSPACE OVERVIEW</span><h1>Good morning, Admin.</h1><p>Here is what is happening across your WhatsApp operation today.</p></div><div className="wm-welcome-actions"><button className="wm-soft-btn">Import contacts</button><button className="wm-primary-btn">+ New campaign</button></div></section>
    <section className="wm-status-banner"><div><span className="wm-status-icon"><DashboardIcon name="message"/></span><div><b>Connect WhatsApp Business</b><p>Link your Meta WhatsApp Business account to start receiving real conversations.</p></div></div><button>Connect account &gt;</button></section>
    <section className="wm-kpis">
      <article><span className="wm-kpi-icon purple"><DashboardIcon name="message"/></span><div><small>Total messages</small><b>18,429</b><em>+12.4% this week</em></div></article>
      <article><span className="wm-kpi-icon blue"><DashboardIcon name="delivery"/></span><div><small>Delivery rate</small><b>96.8%</b><em>+1.8% this week</em></div></article>
      <article><span className="wm-kpi-icon violet"><DashboardIcon name="lead"/></span><div><small>Active leads</small><b>742</b><em>+38 new today</em></div></article>
      <article><span className="wm-kpi-icon cyan"><DashboardIcon name="ai"/></span><div><small>AI actions</small><b>1,284</b><em>+23.1% this week</em></div></article>
    </section>
    <section className="wm-grid-main">
      <article className="wm-card wm-chart-card"><div className="wm-card-head"><div><span className="eyebrow">ACTIVITY</span><h3>Message activity</h3></div><select defaultValue="7"><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></div><div className="wm-chart-legend"><span><i className="sent"/>Sent</span><span><i className="read"/>Read</span></div><div className="wm-chart-area"><div className="wm-ylabels"><span>4K</span><span>3K</span><span>2K</span><span>1K</span><span>0</span></div><svg viewBox="0 0 700 220" preserveAspectRatio="none" aria-label="Message activity chart"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7134d8" stopOpacity=".25"/><stop offset="100%" stopColor="#7134d8" stopOpacity="0"/></linearGradient></defs><path className="wm-area" d="M0 175 C60 145,85 155,130 120 S220 145,275 95 S360 120,410 70 S500 105,555 55 S640 80,700 30 L700 220 L0 220Z"/><path className="wm-line-primary" d="M0 175 C60 145,85 155,130 120 S220 145,275 95 S360 120,410 70 S500 105,555 55 S640 80,700 30"/><path className="wm-line-secondary" d="M0 190 C60 170,90 180,135 145 S220 165,280 125 S360 145,415 105 S500 125,560 90 S645 105,700 65"/></svg><div className="wm-xlabels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div></article>
      <article className="wm-card wm-ai-card"><div className="wm-card-head"><div><span className="eyebrow">INTELLIGENCE</span><h3>MARK AI</h3></div><span className="wm-live"><i/> LIVE</span></div><div className="wm-ai-orb"><DashboardIcon name="ai"/></div><h4>23 conversations need attention.</h4><p>8 qualified leads are ready for follow-up. 3 conversations have unresolved questions.</p><button className="wm-primary-btn">Open MARK AI &gt;</button></article>
    </section>
    <section className="wm-grid-bottom">
      <article className="wm-card"><div className="wm-card-head"><div><span className="eyebrow">RECENT</span><h3>Campaigns</h3></div><button className="wm-link-btn">View all &gt;</button></div><div className="wm-table"><div className="wm-table-row head"><span>Campaign</span><span>Status</span><span>Sent</span><span>Read</span></div><div className="wm-table-row"><span><b>September Follow-up</b><small>Today, 10:30 AM</small></span><span><em className="status done">Completed</em></span><span>4,820</span><span>81.2%</span></div><div className="wm-table-row"><span><b>New Customer Welcome</b><small>Yesterday</small></span><span><em className="status live">Running</em></span><span>2,140</span><span>76.4%</span></div><div className="wm-table-row"><span><b>Product Update</b><small>Sep 4</small></span><span><em className="status draft">Draft</em></span><span>-</span><span>-</span></div></div></article>
      <article className="wm-card"><div className="wm-card-head"><div><span className="eyebrow">WORKSPACE</span><h3>Quick actions</h3></div></div><div className="wm-quick-actions"><button><i><DashboardIcon name="campaign"/></i><span><b>Start campaign</b><small>Reach approved contacts</small></span></button><button><i><DashboardIcon name="contact"/></i><span><b>Add contact</b><small>Create a CRM profile</small></span></button><button><i><DashboardIcon name="employee"/></i><span><b>AI employee</b><small>Create a specialist agent</small></span></button><button><i><DashboardIcon name="automation"/></i><span><b>Automation</b><small>Build a workflow</small></span></button></div></article>
      <article className="wm-card wm-activity-card"><div className="wm-card-head"><div><span className="eyebrow">LIVE</span><h3>Recent activity</h3></div></div><div className="wm-activity-list">{activity.map(([icon,title,body,time])=><div className="wm-activity" key={title}><i><DashboardIcon name={icon}/></i><div><b>{title}</b><span>{body}</span></div><small>{time}</small></div>)}</div></article>
    </section>
  </div>;
}