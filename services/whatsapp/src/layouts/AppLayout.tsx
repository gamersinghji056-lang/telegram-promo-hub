import type { PropsWithChildren } from "react";
import { AppNavigation } from "../app-shell/components/AppNavigation";
import { productConfig } from "../config/product";
import { appNavigation } from "../config/navigation";

type AppLayoutProps = PropsWithChildren<object>;

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="app-shell">
      <AppNavigation links={appNavigation} />
      <section className="app-content">
        <div className="app-title-bar">
          <h1>{productConfig.label}</h1>
        </div>
        {children}
      </section>
    </div>
  );
}
