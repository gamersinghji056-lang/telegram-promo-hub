import { pricingPlans } from "../../config/landingContent";

export function LandingPricing() {
  return (
    <section className="block" id="pricing">
      <div className="container">
        <div className="center-head">
          <div className="kicker">PRICING</div>
          <h2>Plans that scale with your operation.</h2>
          <p>Preview pricing structure for product design. Final limits and charges will be finalized before launch.</p>
        </div>
        <div className="cards">
          {pricingPlans.map((plan) => (
            <article className="card3d tilt" key={plan.title}>
              <span className="mini">{plan.title.toUpperCase()}</span>
              <div className="card-icon">▦</div>
              <h3>{plan.title}</h3>
              <p>{plan.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
