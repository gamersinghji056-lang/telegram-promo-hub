import { Link } from "react-router-dom";
import { useState } from "react";
import type { MenuItem } from "../../config/navigation";
import { productConfig } from "../../config/product";

type PublicNavigationProps = {
  links: MenuItem[];
  authLinks: {
    login: MenuItem;
    primaryAction: MenuItem;
  };
};

export function PublicNavigation({ links, authLinks }: PublicNavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const toggleMenu = () => setIsMenuOpen((value) => !value);

  return (
    <header className="site-header">
      <Link className="site-brand" to="/">
        <span className="site-brand-mark">M</span>
        <span className="site-brand-copy">
          <span>{productConfig.name}</span>
          <small>{productConfig.label}</small>
        </span>
      </Link>

      <button
        type="button"
        className={`menu-toggle ${isMenuOpen ? "open" : ""}`}
        aria-label={isMenuOpen ? "Close menu" : "Open menu"}
        aria-expanded={isMenuOpen}
        onClick={toggleMenu}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <div className={`site-nav ${isMenuOpen ? "open" : ""}`}>
        <nav aria-label="Primary">
          {links.map((route) => (
            <Link key={route.path} to={route.path} onClick={() => setIsMenuOpen(false)}>
              {route.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="site-auth">
        <Link className="link-button" to={authLinks.login.path} onClick={() => setIsMenuOpen(false)}>
          {authLinks.login.label}
        </Link>
        <Link
          className="primary-button"
          to={authLinks.primaryAction.path}
          onClick={() => setIsMenuOpen(false)}
        >
          {authLinks.primaryAction.label}
        </Link>
      </div>
    </header>
  );
}
