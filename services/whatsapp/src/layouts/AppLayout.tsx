import { Outlet } from "react-router-dom";
import { AppNavigation } from "../app-shell/components/AppNavigation";
import { productConfig } from "../config/product";
import { appNavigation } from "../config/navigation";

export function AppLayout() {
  return (
    <div className="app-shell">
      <AppNavigation links={appNavigation} />
      <section className="app-content">
        <div className="app-title-bar">
          <h1>{productConfig.label}</h1>
        </div>
        <Outlet />
      </section>
    </div>
  );
}
