import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ProductIcon, type ProductIconName } from "@/components/product-icon";
import { TelegramPromotionMark } from "@/components/telegram-promotion-mark";

const primaryItems = [
  { slug: "dashboard", label: "Home", icon: "home" },
  { slug: "campaigns", label: "Campaigns", icon: "campaigns" },
  { slug: "audience", label: "Audience", icon: "audience" },
  { slug: "analytics", label: "Analytics", icon: "analytics" },
  { slug: "settings", label: "Settings", icon: "settings" },
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

export function MiniAppShell({ active, children, headerActions }: { active: string; children: ReactNode; headerActions?: ReactNode }) {
  const activePrimary = PRIMARY_SECTION_BY_ROUTE[active] ?? "dashboard";

  return (
    <div
      className="mini-app-compact min-h-screen overflow-x-clip bg-background text-foreground"
      style={{
        paddingBottom:
          "calc(var(--miniapp-bottom-nav-height, 4.375rem) + var(--miniapp-keyboard-inset, 0px) + env(safe-area-inset-bottom))",
      }}
    >
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 px-3 py-1.5 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex min-h-10 max-w-4xl items-center justify-between gap-2">
          <Link
            to="/mini-app/$section"
            params={{ section: "dashboard" }}
            className="flex min-w-0 items-center gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Telegram Promotion home"
          >
            <TelegramPromotionMark className="size-8 shrink-0 text-primary drop-shadow-sm" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[13px] font-semibold tracking-tight">Telegram Promotion</span>
              <span className="block whitespace-nowrap text-[8px] font-medium uppercase tracking-[0.12em] text-muted-foreground">PROMOTION WORKSPACE</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="hidden items-center gap-1.5 rounded-full border border-success/20 bg-success/10 px-2.5 py-1 text-[10px] font-semibold text-success min-[360px]:inline-flex"><span className="size-1.5 rounded-full bg-success shadow-[0_0_0_3px_color-mix(in_oklch,var(--success)_16%,transparent)]" aria-hidden="true" /> Live</span>
            {headerActions}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl p-3 sm:p-4">{children}</main>
      <nav
        aria-label="Primary navigation"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-card/95 shadow-[0_-8px_30px_rgba(2,6,23,0.12)] backdrop-blur-xl transition-transform"
        style={{ transform: "translateY(var(--miniapp-nav-translate, 0px))", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid h-[var(--miniapp-bottom-nav-height,4.375rem)] max-w-4xl grid-cols-5 px-1.5 py-1">
          {primaryItems.map(({ slug, label, icon }) => {
            const selected = activePrimary === slug;
            return (
              <Link
                key={slug}
                to="/mini-app/$section"
                params={{ section: slug }}
                aria-current={selected ? "page" : undefined}
                className={`group relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[9px] font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring ${selected ? "bg-primary/8 text-primary shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--primary)_12%,transparent)]" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <span className={`grid size-7 place-items-center rounded-lg transition-transform ${selected ? "-translate-y-0.5 drop-shadow-sm" : "opacity-85"}`}>
                  <ProductIcon name={icon as ProductIconName} className="size-6 shrink-0 transition-transform duration-150 group-active:scale-95" />
                </span>
                <span className="w-full truncate text-center">{label}</span>
                {selected ? <span className="absolute bottom-0.5 h-0.5 w-4 rounded-full bg-primary" aria-hidden="true" /> : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
