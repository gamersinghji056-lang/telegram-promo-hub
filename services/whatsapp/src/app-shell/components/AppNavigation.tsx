import { Link, useLocation } from "react-router-dom";
import type { RouteSpec } from "../../config/navigation";
import { productConfig } from "../../config/product";

type AppNavigationProps = {
  links: RouteSpec[];
};

export function AppNavigation({ links }: AppNavigationProps) {
  const location = useLocation();

  return (
    <aside className="app-sidebar">
      <Link className="app-brand" to="/">
        {productConfig.name}
      </Link>
      <nav aria-label="App navigation">
        {links.map((route) => (
          <Link
            key={route.path}
            to={route.path}
            className={location.pathname === route.path ? "active" : undefined}
          >
            {route.label}
          </Link>
        ))}
      </nav>
      <p className="app-footer">Signed-in shell placeholder</p>
    </aside>
  );
}
