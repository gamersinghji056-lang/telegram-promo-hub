import { analyticsCards } from "../../config/landingContent";

export function LandingAnalytics() {
  return (
    <section className="block" id="analytics">
      <div className="container">
        <div className="center-head">
          <div className="kicker">ANALYTICS</div>
          <h2>Operational visibility with actionable insights.</h2>
        </div>
        <div className="analytics-grid">
          <div className="analytics-cards">
            {analyticsCards.map((item) => (
              <article className="panel panel-tight" key={item.title}>
                <p>{item.title}</p>
                <strong>{item.value}</strong>
                <span>{item.change} this week</span>
              </article>
            ))}
          </div>
          <div className="chart-card">
            <h3>Response throughput</h3>
            <div className="chart">
              <div className="chart-item">
                <span>Mon</span>
                <div className="bar-track">
                  <i style={{ width: "56%" }} />
                </div>
                <strong>56%</strong>
              </div>
              <div className="chart-item">
                <span>Tue</span>
                <div className="bar-track">
                  <i style={{ width: "82%" }} />
                </div>
                <strong>82%</strong>
              </div>
              <div className="chart-item">
                <span>Wed</span>
                <div className="bar-track">
                  <i style={{ width: "61%" }} />
                </div>
                <strong>61%</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
