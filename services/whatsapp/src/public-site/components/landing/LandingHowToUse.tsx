import { howToUseSteps } from "../../config/landingContent";

export function LandingHowToUse() {
  return (
    <section className="block" id="how">
      <div className="container">
        <div className="center-head">
          <div className="kicker">HOW TO USE</div>
          <h2>From setup to daily operations.</h2>
          <p>
            A structured onboarding flow that helps teams connect WhatsApp, organize customers, configure MARK and operate daily.
          </p>
        </div>
        <div className="cards">
          {howToUseSteps.map((step, index) => (
            <article className="card3d tilt" key={step.title}>
              <span className="mini">{`STEP ${String(index + 1).padStart(2, "0")}`}</span>
              <div className="card-icon">{index + 1}</div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
