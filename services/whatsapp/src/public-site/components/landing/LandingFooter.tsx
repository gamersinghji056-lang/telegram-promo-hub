import { Link } from "react-router-dom";
import { productConfig } from "../../../config/product";
import { publicFooterLinks } from "../../../config/navigation";

export function LandingFooter() {
  return (
    <footer>
      <div className="container">
        <div className="footgrid">
          <div>
            <a className="brand" href="#top">
              <span className="site-brand-mark">WA</span>
              <div className="brand-copy">
                <b>{productConfig.name}</b>
                <span>{productConfig.label}</span>
              </div>
            </a>
          </div>
          {publicFooterLinks.map((section) => (
            <div key={section.title} className="foot-col">
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
          <div>
            <h4>Community</h4>
            <ul>
              <li>
                <Link to="/login">Log in</Link>
              </li>
              <li>
                <Link to="/register">Get started</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="copyline">© {new Date().getFullYear()} WA MARK · {productConfig.domain} · 3D concept website</div>
      </div>
    </footer>
  );
}
