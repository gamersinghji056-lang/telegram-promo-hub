import type { PropsWithChildren } from "react";
import { PublicNavigation } from "../public-site/components/PublicNavigation";

type PublicLayoutProps = PropsWithChildren<{
  links: { path: string; label: string }[];
}>;

export function PublicLayout({ children, links }: PublicLayoutProps) {
  return (
    <div className="site-shell">
      <PublicNavigation links={links} />
      <main>{children}</main>
    </div>
  );
}
