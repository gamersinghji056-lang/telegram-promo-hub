import { Outlet } from "react-router-dom";
import { AppNavigation } from "../app-shell/components/AppNavigation";
import { appNavigation } from "../config/navigation";

function SearchIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>}
function BellIcon(){return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3V9z"/><path d="M10 20h4"/></svg>}

export function AppLayout(){
  return <div className="wm-app-shell">
    <AppNavigation links={appNavigation}/>
    <main className="wm-app-main">
      <header className="wm-topbar">
        <div className="wm-search"><span><SearchIcon/></span><input aria-label="Search workspace" placeholder="Search conversations, contacts or tasks..."/><kbd>Ctrl K</kbd></div>
        <div className="wm-top-actions"><button aria-label="Notifications"><BellIcon/><i/></button><button className="wm-help" aria-label="Help">?</button><div className="wm-user"><span>AD</span><div><b>Admin</b><small>Workspace owner</small></div></div></div>
      </header>
      <div className="wm-page"><Outlet/></div>
    </main>
  </div>;
}