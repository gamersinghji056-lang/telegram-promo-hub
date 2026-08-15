import { Link } from "@tanstack/react-router";
import { BarChart3, FolderOpen, LayoutDashboard, Megaphone, Tags, Users } from "lucide-react";
import type { ReactNode } from "react";

const items = [
  ["dashboard", "Home", LayoutDashboard],
  ["campaigns", "Campaigns", Megaphone],
  ["groups-approved", "Groups", FolderOpen],
  ["dm-audience", "Users", Users],
  ["group-categories", "Categories", Tags],
  ["analytics", "Analytics", BarChart3],
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
        <div className="mx-auto grid max-w-3xl grid-cols-6 gap-1 px-2 py-2">
          {items.map(([slug, label, Icon]) => (
            <Link
              key={slug}
              to="/mini-app/$section"
              params={{ section: slug }}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-[10px] font-medium transition-colors ${active === slug ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
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
