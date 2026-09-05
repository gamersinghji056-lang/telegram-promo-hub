const stats = [
  { label: "Active conversations", value: "1,420", trend: "+12%" },
  { label: "Follow-ups completed", value: "884", trend: "+8%" },
  { label: "Media items processed", value: "2,106", trend: "+19%" },
  { label: "AI-assisted actions", value: "1,010", trend: "+15%" },
];

const chartBars = [
  { label: "Mon", value: 56 },
  { label: "Tue", value: 82 },
  { label: "Wed", value: 61 },
  { label: "Thu", value: 93 },
  { label: "Fri", value: 77 },
];

export function LandingAnalytics() {
  return (
    <section className="section">
      <div className="section-shell">
        <p className="section-kicker">Analytics</p>
        <h2>Operational visibility at a glance</h2>
        <div className="analytics-grid">
          <div className="analytics-cards">
            {stats.map((stat) => (
              <article key={stat.label} className="panel panel-tight">
                <p>{stat.label}</p>
                <strong>{stat.value}</strong>
                <small>{stat.trend} this week</small>
              </article>
            ))}
          </div>
          <div className="chart-card">
            <h3>Response throughput</h3>
            <div className="chart">
              {chartBars.map((bar) => (
                <div key={bar.label} className="chart-item">
                  <span>{bar.label}</span>
                  <div className="bar-track">
                    <i style={{ width: `${bar.value}%` }} />
                  </div>
                  <strong>{bar.value}%</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

