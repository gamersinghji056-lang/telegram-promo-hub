import { Outlet } from "react-router-dom";
import type { MenuItem } from "../config/navigation";
import { PublicNavigation } from "../public-site/components/PublicNavigation";

type PublicLayoutProps = {
  links: MenuItem[];
  authLinks: {
    login: MenuItem;
    primaryAction: MenuItem;
  };
};

export function PublicLayout({ links, authLinks }: PublicLayoutProps) {
  return (
    <div className="site-shell">
      <PublicNavigation links={links} authLinks={authLinks} />
      <main className="landing-main">
        <Outlet />
      </main>
    </div>
  );
}
