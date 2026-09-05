import { Link } from "react-router-dom";
import { productConfig } from "../../../config/product";
import { publicFooterLinks } from "../../../config/navigation";

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="section-shell">
        <h2>{productConfig.domain}</h2>
        <p>{productConfig.label}</p>
        <div className="footer-grid">
          {publicFooterLinks.map((section) => (
            <div key={section.title} className="footer-column">
              <h4>{section.title}</h4>
              <ul>
                {section.links.map((link) => (
                  <li key={link.path + link.label}>
                    <Link to={link.path}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
