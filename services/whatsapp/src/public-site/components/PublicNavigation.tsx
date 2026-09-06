import { Link } from "react-router-dom";
import { useState } from "react";
import type { MenuItem } from "../../config/navigation";

type PublicNavigationProps = {
  links: MenuItem[];
  authLinks: { login: MenuItem; primaryAction: MenuItem };
};

export function PublicNavigation({ links, authLinks }: PublicNavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeMenu = () => setIsMenuOpen(false);
  return (
    <header className="site-header v6-header">
      <div className="v6-nav">
        <Link className="v6-brand" to="/" onClick={closeMenu}>
          <div className="v6-logo" aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none">
              <path d="M32 9C19.3 9 9 18.7 9 30.7c0 4.3 1.3 8.3 3.6 11.6L10 52.8l10.9-3A23.8 23.8 0 0 0 32 52.4c12.7 0 23-9.7 23-21.7S44.7 9 32 9Z" stroke="#fff" strokeWidth="4" />
              <path d="M24.2 21.7c.8-.9 1.6-1 2.4-.6l3.3 5c.4.7.2 1.3-.3 1.8l-1.4 1.4c1.9 3.5 4.6 6.2 8.1 8.1l1.5-1.4c.6-.5 1.2-.6 1.9-.3l5 3.2c.5.7.4 1.5-.2 2.2-1.5 2-3.9 2.9-6.4 2.2-7.8-2.1-14.9-9-16.9-16.7-.6-2.1.3-3.9 3-4.9Z" fill="#fff" />
            </svg>
          </div>
          <div className="v6-brandtext"><b>WA MARK</b><span>AI Workspace for WhatsApp Business</span></div>
        </Link>

        <button type="button" className={`menu-toggle ${isMenuOpen ? "open" : ""}`} aria-label="Toggle menu" aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen(v => !v)}><span /><span /><span /></button>

        <nav className={`v6-links ${isMenuOpen ? "open" : ""}`} aria-label="Primary">
          {links.map((route) => <Link key={route.path} to={route.path} onClick={closeMenu}>{route.label}</Link>)}
        </nav>
        <div className="v6-navcta">
          <Link className="btn" to={authLinks.login.path}>Log in</Link>
          <Link className="btn primary" to={authLinks.primaryAction.path}>Get started</Link>
        </div>
      </div>
    </header>
  );
}

