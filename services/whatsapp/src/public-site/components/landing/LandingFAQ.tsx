import { faqItems } from "../../config/landingContent";

export function LandingFaq() {
  return (
    <section className="block" id="faq">
      <div className="container">
        <div className="center-head">
          <div className="kicker">FAQ</div>
          <h2>Questions businesses ask first.</h2>
        </div>
        <div className="faq-grid">
          {faqItems.map((item) => (
            <details className="faq-item" key={item.question}>
              <summary className="faq-q">{item.question}</summary>
              <div className="faq-a">{item.answer}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
