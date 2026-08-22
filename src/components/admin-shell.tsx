import { Link, useNavigate } from "@tanstack/react-router";
import { BarChart3, Bell, Bot, CreditCard, FileText, LayoutDashboard, LockKeyhole, LogOut, Settings, TrendingUp, UserPlus, Users, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const items = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["customers", "Customers", Users],
  ["plans", "Plans", WalletCards],
  ["subscriptions", "Subscriptions", FileText],
  ["payments", "Payments", CreditCard],
  ["usage", "Usage", TrendingUp],
  ["notifications", "Notifications", Bell],
  ["registration", "Registration", UserPlus],
  ["telegram", "Telegram", Bot],
  ["analytics", "Analytics", BarChart3],
  ["logs", "Logs", FileText],
  ["settings", "Settings", Settings],
  ["account", "Account / Security", LockKeyhole],
] as const;

export function AdminShell({ active, children }: { active: string; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-border bg-card lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between px-5 lg:h-20">
          <div><p className="text-xs font-semibold uppercase text-primary">WPAY</p><p className="font-semibold">Admin Console</p></div>
          <Button
            variant="secondary"
            className="h-9 min-h-9 px-3 lg:hidden"
            aria-label="Sign out"
            onClick={async () => { await supabase.auth.signOut(); await navigate({ to: "/admin/login" }); }}
          ><LogOut className="size-4" /></Button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1 lg:overflow-y-auto">
          {items.map(([slug, label, Icon]) => (
            <Link
              key={slug}
              to="/admin/$section"
              params={{ section: slug }}
              className={`flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm ${active === slug ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            ><Icon className="size-4" />{label}</Link>
          ))}
        </nav>
        <div className="hidden px-3 pt-8 lg:block">
          <Button variant="secondary" className="w-full justify-start" onClick={async () => { await supabase.auth.signOut(); await navigate({ to: "/admin/login" }); }}><LogOut className="size-4" />Sign out</Button>
        </div>
      </aside>
      <main className="min-w-0 p-4 sm:p-7 lg:p-10">{children}</main>
    </div>
  );
}
