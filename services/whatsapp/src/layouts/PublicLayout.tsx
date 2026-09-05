import type { PropsWithChildren } from "react";
import type { MenuItem } from "../config/navigation";
import { PublicNavigation } from "../public-site/components/PublicNavigation";

type PublicLayoutProps = PropsWithChildren<{
  links: MenuItem[];
  authLinks: {
    login: MenuItem;
    primaryAction: MenuItem;
  };
}>;

export function PublicLayout({ children, links, authLinks }: PublicLayoutProps) {
  return (
    <div className="site-shell">
      <PublicNavigation links={links} authLinks={authLinks} />
      <main>{children}</main>
    </div>
  );
}
