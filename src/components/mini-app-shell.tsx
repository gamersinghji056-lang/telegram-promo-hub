import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  Bot,
  CreditCard,
  FolderOpen,
  LayoutDashboard,
  Megaphone,
  Search,
  Settings,
  Send,
} from "lucide-react";
import type { ReactNode } from "react";

const items = [
  ["dashboard", "Home", LayoutDashboard],
  ["sessions", "Sessions", Bot],
  ["groups-find", "Group Finder", Search],
  ["groups-approved", "Approved Groups", FolderOpen],
  ["group-categories", "Categories", FolderOpen],
  ["campaigns", "Campaigns", Megaphone],
  ["dm-create", "DM Promotion", Send],
  ["group-create", "Group Promotion", Megaphone],
  ["analytics", "Analytics", BarChart3],
  ["billing", "Billing", CreditCard],
  ["settings", "Settings", Settings],
] as const;

export function MiniAppShell({ active, children }: { active: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background pb-24 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">WPAY Promotion</p>
            <p className="text-sm font-medium">Customer control panel</p>
          </div>
          <div className="size-2 rounded-full bg-success" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-4 sm:p-6">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card">
        <div className="mx-auto flex max-w-3xl overflow-x-auto px-2 py-2">
          {items.map(([slug, label, Icon]) => (
            <Link
              key={slug}
              to="/mini-app/$section"
              params={{ section: slug }}
              className={`flex min-w-20 flex-1 flex-col items-center gap-1 rounded-md px-2 py-2 text-[11px] ${active === slug ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
