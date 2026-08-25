import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  Bot,
  CreditCard,
  FolderOpen,
  Gauge,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Search,
  Settings,
  Send,
  Tags,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

const items = [
  ["dashboard", "Home", Gauge, "#2f80ed"],
  ["sessions", "Sessions", Bot, "#00a884"],
  ["groups-find", "Group Finder", Search, "#13a8a8"],
  ["groups-approved", "Approved Groups", FolderOpen, "#4f8cff"],
  ["dm-create", "DM Promotion", Send, "#17a2b8"],
  ["group-create", "Group Promotion", Megaphone, "#f59f00"],
  ["campaigns", "Campaigns", MessageCircle, "#e8590c"],
  ["dm-audience", "Find Users", Users, "#7950f2"],
  ["add-users", "Add Users", Users, "#0ca678"],
  ["group-categories", "Categories", Tags, "#12b886"],
  ["analytics", "Analytics", BarChart3, "#228be6"],
  ["billing", "Billing", CreditCard, "#40c057"],
  ["settings", "Settings", Settings, "#868e96"],
] as const;

export function MiniAppShell({ active, children }: { active: string; children: ReactNode }) {
  return (
    <div
      className="mini-app-compact min-h-screen bg-background text-foreground"
      style={{
        paddingBottom: "calc(var(--miniapp-bottom-nav-height, 5rem) + var(--miniapp-keyboard-inset, 0px))",
      }}
    >
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-3 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">WPAY Promotion</p>
            <p className="text-sm font-medium">Customer control panel</p>
          </div>
          <div className="size-2 rounded-full bg-success" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-3 sm:p-5">{children}</main>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur transition-transform"
        style={{ transform: "translateY(var(--miniapp-nav-translate, 0px))" }}
      >
        <div className="mx-auto flex max-w-3xl gap-1.5 overflow-x-auto px-2 py-2">
          {items.map(([slug, label, Icon, accent]) => {
            const selected = active === slug;
            return (
              <Link
                key={slug}
                to="/mini-app/$section"
                params={{ section: slug }}
                className="flex min-h-12 min-w-18 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-[10px] font-semibold transition-colors"
                style={{
                  color: selected ? accent : "var(--foreground)",
                  borderColor: selected ? `${accent}55` : "transparent",
                  backgroundColor: selected ? `color-mix(in srgb, ${accent} 16%, transparent)` : "transparent",
                }}
              >
                <Icon className="size-4" style={{ color: accent }} />
                <span className={selected ? "" : "opacity-85"}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
