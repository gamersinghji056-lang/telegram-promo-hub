import { Link, useLocation } from "react-router-dom";
import type { RouteSpec } from "../../config/navigation";

type AppNavigationProps = { links: RouteSpec[] };

const iconFor: Record<string, string> = {
  Inbox:"â—‰", Contacts:"â—Ž", Campaigns:"â—‡", Templates:"â–¤", Leads:"â™¢", "MARK AI":"âœ¦",
  "AI Employees":"âŒ˜", Automations:"âš™", Media:"â–§", "Web Tasks":"â†—", Analytics:"â–¥",
  Integrations:"âŠž", Team:"â™™", Billing:"â—«", Settings:"âš™"
};

const sectionFor = (label: string) => {
  if (["Inbox","Contacts","Leads"].includes(label)) return "Workspace";
  if (["MARK AI","AI Employees","Automations"].includes(label)) return "Intelligence";
  if (["Campaigns","Templates","Analytics"].includes(label)) return "Growth";
  return "Manage";
};

export function AppNavigation({ links }: AppNavigationProps) {
  const location = useLocation();
  let lastSection = "";

  return (
    <aside className="wm-sidebar">
      <Link className="wm-brand" to="/">
        <span className="wm-brand-logo">WA</span>
        <span><b>WA MARK</b><small>Business AI Workspace</small></span>
      </Link>

      <Link className={`wm-nav-link wm-dashboard-link ${location.pathname === "/app" ? "active" : ""}`} to="/app"><i>â—ˆ</i><span>Dashboard</span></Link>

      <nav className="wm-nav" aria-label="App navigation">
        {links.map((route) => {
          const section = sectionFor(route.label);
          const showSection = section !== lastSection;
          lastSection = section;
          return (
            <div key={route.path}>
              {showSection && <div className="wm-nav-section">{section}</div>}
              <Link to={route.path} className={`wm-nav-link ${location.pathname === route.path ? "active" : ""}`}>
                <i>{iconFor[route.label] || "â€¢"}</i><span>{route.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="wm-sidebar-bottom">
        <div className="wm-plan"><div><span>PRO PLAN</span><b>Workspace active</b></div><strong>82%</strong><i><em /></i><small>8,200 / 10,000 AI actions</small></div>
        <Link className="wm-nav-link" to="/app/settings"><i>âš™</i><span>Settings</span></Link>
      </div>
    </aside>
  );
}