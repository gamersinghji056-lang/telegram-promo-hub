import { Link } from "react-router-dom";
import type { RouteSpec } from "../../config/navigation";
import { productConfig } from "../../config/product";

type PublicNavigationProps = {
  links: RouteSpec[];
};

export function PublicNavigation({ links }: PublicNavigationProps) {
  return (
    <header className="site-header">
      <Link className="site-brand" to="/">
        {productConfig.name}
      </Link>
      <nav aria-label="Public navigation">
        {links.map((route) => (
          <Link key={route.path} to={route.path}>
            {route.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
