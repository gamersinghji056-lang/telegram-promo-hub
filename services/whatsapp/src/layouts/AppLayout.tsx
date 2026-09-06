import { Outlet } from "react-router-dom";
import { AppNavigation } from "../app-shell/components/AppNavigation";
import { appNavigation } from "../config/navigation";

export function AppLayout() {
  return (
    <div className="wm-app-shell">
      <AppNavigation links={appNavigation} />
      <main className="wm-app-main">
        <header className="wm-topbar">
          <div className="wm-search"><span>âŒ•</span><input aria-label="Search workspace" placeholder="Search conversations, contacts or tasks..." /><kbd>âŒ˜ K</kbd></div>
          <div className="wm-top-actions"><button aria-label="Notifications">â™¢<i /></button><button className="wm-help">?</button><div className="wm-user"><span>AD</span><div><b>Admin</b><small>Workspace owner</small></div></div></div>
        </header>
        <div className="wm-page"><Outlet /></div>
      </main>
    </div>
  );
}