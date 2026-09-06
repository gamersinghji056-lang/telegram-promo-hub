import { Link, useLocation } from "react-router-dom";
import type { RouteSpec } from "../../config/navigation";

type AppNavigationProps = { links: RouteSpec[] };
type IconName = "dashboard"|"inbox"|"contacts"|"campaigns"|"templates"|"leads"|"ai"|"employees"|"automation"|"media"|"web"|"analytics"|"integrations"|"team"|"billing"|"settings";

const icons: Record<string, IconName> = {
  Inbox:"inbox", Contacts:"contacts", Campaigns:"campaigns", Templates:"templates", Leads:"leads",
  "MARK AI":"ai", "AI Employees":"employees", Automations:"automation", Media:"media",
  "Web Tasks":"web", Analytics:"analytics", Integrations:"integrations", Team:"team",
  Billing:"billing", Settings:"settings"
};

function NavIcon({name}:{name:IconName}) {
  const p = {
    dashboard:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    inbox:<><path d="M4 5h16v13H4z"/><path d="M4 13h5l2 3h2l2-3h5"/></>,
    contacts:<><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-4 3.1-6 7-6s6.2 2 7 6"/></>,
    campaigns:<><path d="M4 12l11-5v10L4 12z"/><path d="M15 10h4a2 2 0 0 1 0 4h-4"/><path d="M7 14l1.5 5"/></>,
    templates:<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
    leads:<><path d="M12 3l2.3 5.1L20 9l-4 3.9.9 5.6L12 16l-4.9 2.5.9-5.6L4 9l5.7-.9L12 3z"/></>,
    ai:<><path d="M12 2l1.7 5.2L19 9l-5.3 1.8L12 16l-1.7-5.2L5 9l5.3-1.8L12 2z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/></>,
    employees:<><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c.6-4 2.6-6 6-6s5.4 2 6 6"/><path d="M14 15c3.8-.7 6.2 1 7 5"/></>,
    automation:<><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></>,
    media:<><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M4 17l5-5 4 4 2-2 5 5"/></>,
    web:<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9S14.5 18.5 12 21M12 3C9.5 5.5 8.5 8.5 8.5 12s1 6.5 3.5 9"/></>,
    analytics:<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    integrations:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M17.5 14v7M14 17.5h7"/></>,
    team:<><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 20c.6-4 2.4-6 5.5-6s5 2 5.5 6M14 15c3.6-.7 6 1 7 5"/></>,
    billing:<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h4"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></>
  }[name];
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{p}</svg>;
}

const sectionFor=(label:string)=>{
  if(["Inbox","Contacts","Leads"].includes(label)) return "Workspace";
  if(["MARK AI","AI Employees","Automations"].includes(label)) return "Intelligence";
  if(["Campaigns","Templates","Analytics"].includes(label)) return "Growth";
  return "Manage";
};

export function AppNavigation({links}:AppNavigationProps){
  const location=useLocation(); let lastSection="";
  return <aside className="wm-sidebar">
    <Link className="wm-brand" to="/"><span className="wm-brand-logo">WA</span><span><b>WA MARK</b><small>Business AI Workspace</small></span></Link>
    <Link className={`wm-nav-link wm-dashboard-link ${location.pathname==="/app"?"active":""}`} to="/app"><i><NavIcon name="dashboard"/></i><span>Dashboard</span></Link>
    <nav className="wm-nav" aria-label="App navigation">
      {links.map(route=>{const section=sectionFor(route.label);const show=section!==lastSection;lastSection=section;const icon=icons[route.label]||"dashboard";return <div key={route.path}>
        {show&&<div className="wm-nav-section">{section}</div>}
        <Link to={route.path} className={`wm-nav-link ${location.pathname===route.path?"active":""}`}><i><NavIcon name={icon}/></i><span>{route.label}</span></Link>
      </div>})}
    </nav>
    <div className="wm-sidebar-bottom"><div className="wm-plan"><div><span>PRO PLAN</span><b>Workspace active</b></div><strong>82%</strong><i><em/></i><small>8,200 / 10,000 AI actions</small></div></div>
  </aside>;
}