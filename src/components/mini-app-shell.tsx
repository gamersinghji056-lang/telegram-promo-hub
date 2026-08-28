import { Link } from "@tanstack/react-router";
import { BarChart3, Home, Megaphone, Settings, Users } from "lucide-react";
import type { ReactNode } from "react";

const primaryItems = [
  { slug: "dashboard", label: "Home", icon: Home },
  { slug: "campaigns", label: "Campaigns", icon: Megaphone },
  { slug: "audience", label: "Audience", icon: Users },
  { slug: "analytics", label: "Analytics", icon: BarChart3 },
  { slug: "settings", label: "Settings", icon: Settings },
] as const;

const PRIMARY_SECTION_BY_ROUTE: Record<string, (typeof primaryItems)[number]["slug"]> = {
  dashboard: "dashboard",
  "dm-create": "campaigns",
  "group-create": "campaigns",
  campaigns: "campaigns",
  "dm-history": "campaigns",
  "group-history": "campaigns",
  audience: "audience",
  "groups-find": "audience",
  "groups-found": "audience",
  "groups-approved": "audience",
  "groups-joined": "audience",
  "group-categories": "audience",
  "dm-audience": "audience",
  "add-users": "audience",
  "growth-intelligence": "audience",
  analytics: "analytics",
  "sessions": "settings",
  "refer-earn": "settings",
  "billing": "settings",
  "settings": "settings",
};

export function MiniAppShell({ active, children }: { active: string; children: ReactNode }) {
  const activePrimary = PRIMARY_SECTION_BY_ROUTE[active] ?? "dashboard";

  return (
    <div
      className="mini-app-compact min-h-screen overflow-x-clip bg-background text-foreground"
      style={{
        paddingBottom:
          "calc(var(--miniapp-bottom-nav-height, 4.75rem) + var(--miniapp-keyboard-inset, 0px) + env(safe-area-inset-bottom))",
      }}
    >
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 px-3 py-2 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <Link
            to="/mini-app/$section"
            params={{ section: "dashboard" }}
            className="flex min-w-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="WPAY Promotion home"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-sm font-black tracking-tight text-primary-foreground shadow-sm">W</span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-bold tracking-tight">WPAY Promotion</span>
              <span className="block truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Promotion workspace</span>
            </span>
          </Link>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" /> Live
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl p-3 sm:p-5">{children}</main>
      <nav
        aria-label="Primary navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-card/95 shadow-[0_-8px_30px_rgba(2,6,23,0.12)] backdrop-blur-xl transition-transform"
        style={{ transform: "translateY(var(--miniapp-nav-translate, 0px))", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid h-[var(--miniapp-bottom-nav-height,4.75rem)] max-w-4xl grid-cols-5 px-1.5 py-1.5">
          {primaryItems.map(({ slug, label, icon: Icon }) => {
            const selected = activePrimary === slug;
            return (
              <Link
                key={slug}
                to="/mini-app/$section"
                params={{ section: slug }}
                aria-current={selected ? "page" : undefined}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${selected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <Icon className="size-[18px] shrink-0" strokeWidth={selected ? 2.25 : 1.8} />
                <span className="w-full truncate text-center">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
