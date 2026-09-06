import { markAiExamples } from "../../config/landingContent";

export function LandingMarkAi() {
  return (
    <section className="block" id="ai">
      <div className="container showcase">
        <div className="showgrid">
          <div className="copy">
            <div className="kicker">MARK AI · THE INTELLIGENCE LAYER</div>
            <h2>AI that understands the work behind the chat.</h2>
            <p>
              MARK AI is designed to understand context across conversations, customer records and business knowledge, then
              prepare useful actions without pretending something happened before execution is confirmed.
            </p>
            <div className="feature-list">
              {markAiExamples.map((item) => (
                <div key={item}>
                  <b>•</b> {item}
                </div>
              ))}
            </div>
          </div>
          <div className="stack">
            <div className="layer l1">
              <div className="layerhead">
                <b>Customer Context</b>
                <span className="tag">CONNECTED</span>
              </div>
              <div className="lines">
                <div className="line" />
                <div className="line" />
                <div className="line" />
              </div>
              <div className="numbers">
                <div className="num">
                  <b>42</b>
                  <small>Messages</small>
                </div>
                <div className="num">
                  <b>7</b>
                  <small>Files</small>
                </div>
                <div className="num">
                  <b>3</b>
                  <small>Follow-ups</small>
                </div>
              </div>
            </div>
            <div className="layer l2">
              <div className="layerhead">
                <b>Business Memory</b>
                <span className="tag">SYNCED</span>
              </div>
              <div className="lines">
                <div className="line" />
                <div className="line" />
                <div className="line" />
              </div>
              <div className="numbers">
                <div className="num">
                  <b>18</b>
                  <small>Notes</small>
                </div>
                <div className="num">
                  <b>5</b>
                  <small>Tags</small>
                </div>
                <div className="num">
                  <b>12</b>
                  <small>Events</small>
                </div>
              </div>
            </div>
            <div className="layer l3">
              <div className="layerhead">
                <b>MARK AI Decision Layer</b>
                <span className="tag">READY</span>
              </div>
              <div className="lines">
                <div className="line" />
                <div className="line" />
                <div className="line" />
              </div>
              <div className="numbers">
                <div className="num">
                  <b>94%</b>
                  <small>Context match</small>
                </div>
                <div className="num">
                  <b>8</b>
                  <small>Next actions</small>
                </div>
                <div className="num">
                  <b>2</b>
                  <small>Approvals</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
