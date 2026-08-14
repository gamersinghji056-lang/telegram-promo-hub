/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, Bot, CheckCircle2, LogOut, RefreshCw } from "lucide-react";
import { MiniAppShell } from "@/components/mini-app-shell";
import { Button } from "@/components/ui/button";
import {
  getAnalytics,
  getBilling,
  getCampaigns,
  getConnections,
  getContactHistory,
  getDashboard,
  getGroups,
  getNotifications,
  getTemplates,
  logout as logoutCustomer,
} from "@/lib/customer.functions";

const valid = new Set([
  "dashboard",
  "connections",
  "discovery",
  "audience",
  "campaigns",
  "messages",
  "queue",
  "analytics",
  "billing",
]);

export const Route = createFileRoute("/mini-app/$section")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.section[0]?.toUpperCase()}${params.section.slice(1)} | WPAY Mini App` },
      { name: "description", content: "Telegram-native campaign and audience control panel." },
      { property: "og:title", content: "WPAY Telegram Mini App" },
      { property: "og:description", content: "Manage Telegram promotion campaigns securely." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MiniAppSection,
});

function telegramAuth(): string | null {
  const telegram = (
    window as unknown as {
      Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } };
    }
  ).Telegram?.WebApp;
  telegram?.ready?.();
  telegram?.expand?.();
  if (telegram?.initData) return `tma ${telegram.initData}`;
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get("sess");
  if (fromHash) {
    sessionStorage.setItem("customer-session", fromHash);
    history.replaceState(null, "", window.location.pathname);
  }
  const session = fromHash ?? sessionStorage.getItem("customer-session");
  return session ? `sess ${session}` : null;
}

function MiniAppSection() {
  const { section } = Route.useParams();
  const dashboardFn = useServerFn(getDashboard);
  const connectionsFn = useServerFn(getConnections);
  const groupsFn = useServerFn(getGroups);
  const audienceFn = useServerFn(getContactHistory);
  const campaignsFn = useServerFn(getCampaigns);
  const templatesFn = useServerFn(getTemplates);
  const analyticsFn = useServerFn(getAnalytics);
  const billingFn = useServerFn(getBilling);
  const notificationsFn = useServerFn(getNotifications);
  const logoutFn = useServerFn(logoutCustomer);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const loaders = useMemo<Record<string, (auth: string) => Promise<any>>>(
    () => ({
      dashboard: (auth) => dashboardFn({ data: { auth } }),
      connections: (auth) => connectionsFn({ data: { auth } }),
      discovery: (auth) => groupsFn({ data: { auth } }),
      audience: (auth) => audienceFn({ data: { auth } }),
      campaigns: (auth) => campaignsFn({ data: { auth } }),
      messages: (auth) => templatesFn({ data: { auth } }),
      queue: (auth) => campaignsFn({ data: { auth, filter: "RUNNING" } }),
      analytics: (auth) => analyticsFn({ data: { auth } }),
      billing: (auth) => billingFn({ data: { auth } }),
    }),
    [
      dashboardFn,
      connectionsFn,
      groupsFn,
      audienceFn,
      campaignsFn,
      templatesFn,
      analyticsFn,
      billingFn,
    ],
  );
  async function load() {
    setBusy(true);
    setError("");
    const auth = telegramAuth();
    if (!valid.has(section)) {
      setError("This section does not exist.");
      setBusy(false);
      return;
    }
    if (!auth) {
      setError("Open this control panel from @Wpaypromotionbot to sign in securely.");
      setBusy(false);
      return;
    }
    try {
      const result = await loaders[section]?.(auth);
      setData(result);
      if (section === "dashboard") void notificationsFn({ data: { auth } });
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes("NO_ACCOUNT")
          ? "No customer account is linked to this Telegram profile. Use Register in the bot first."
          : "Your session could not be verified. Return to the bot and open the Mini App again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    const auth = telegramAuth();
    if (auth) {
      try {
        await logoutFn({ data: { auth } });
      } catch {
        /* local logout still clears the browser session */
      }
    }
    sessionStorage.removeItem("customer-session");
    setData(null);
    setError("You have signed out. Return to the bot to open a secure session.");
  }
  useEffect(() => {
    void load();
  }, [section]);
  return (
    <MiniAppShell active={section}>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">Workspace</p>
          <h1 className="mt-1 text-2xl font-semibold capitalize">{section}</h1>
        </div>
        <div className="flex gap-2">
          <Button size="icon" variant="secondary" aria-label="Refresh" onClick={load}>
            <RefreshCw />
          </Button>
          <Button size="icon" variant="secondary" aria-label="Sign out" onClick={signOut}>
            <LogOut />
          </Button>
        </div>
      </div>
      {error ? (
        <div className="border-l-2 border-warning bg-card p-5">
          <AlertTriangle className="size-5 text-warning" />
          <p className="mt-3 text-sm">{error}</p>
          <a
            href="https://t.me/Wpaypromotionbot"
            className="mt-4 inline-flex text-sm font-semibold text-primary"
          >
            Return to bot
          </a>
        </div>
      ) : busy && !data ? (
        <p className="py-10 text-center text-muted-foreground">Loading workspace…</p>
      ) : (
        <CustomerContent section={section} data={data} />
      )}
    </MiniAppShell>
  );
}

function CustomerContent({ section, data }: { section: string; data: any }) {
  if (section === "dashboard") {
    const stats = [
      ["Connections", data?.connections?.active, data?.connections?.issues],
      ["Groups", data?.groups?.joined, data?.groups?.pending],
      ["Audience", data?.audience?.available, data?.audience?.contacted],
      ["Campaigns", data?.campaigns?.running, data?.campaigns?.failed],
    ];
    return (
      <>
        <section className="mb-4 border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current plan</p>
              <p className="mt-1 text-xl font-semibold">{data?.subscription?.planName}</p>
            </div>
            <Bell className="size-5 text-primary" />
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary"
              style={{
                width: `${Math.min(100, (data?.usage?.messagesUsed / Math.max(data?.usage?.messageLimit, 1)) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {data?.usage?.messagesUsed ?? 0} / {data?.usage?.messageLimit ?? 0} messages
          </p>
        </section>
        <div className="grid grid-cols-2 gap-3">
          {stats.map(([label, main, issue]) => (
            <section key={String(label)} className="border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{main ?? 0}</p>
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                {Number(issue) > 0 ? (
                  <AlertTriangle className="size-3 text-warning" />
                ) : (
                  <CheckCircle2 className="size-3 text-success" />
                )}
                {issue ?? 0} need attention
              </p>
            </section>
          ))}
        </div>
      </>
    );
  }
  const rows = Array.isArray(data) ? data : (data?.campaigns ?? data?.transactions ?? []);
  if (Array.isArray(rows))
    return (
      <div className="space-y-3">
        {rows.map((row: Record<string, any>, i: number) => (
          <article key={row["id"] ?? i} className="border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">
                  {row["name"] ?? row["title"] ?? row["label"] ?? row["email"] ?? `Item ${i + 1}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row["username"]
                    ? `@${row["username"]}`
                    : (row["type"] ?? row["created_at"] ?? "")}
                </p>
              </div>
              <span className="text-xs font-semibold text-primary">
                {row["status"] ?? row["eligibility"] ?? "ACTIVE"}
              </span>
            </div>
          </article>
        ))}
        {!rows.length && (
          <div className="py-12 text-center">
            <Bot className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Nothing here yet.</p>
          </div>
        )}
      </div>
    );
  return (
    <pre className="overflow-auto border border-border bg-card p-4 text-xs text-muted-foreground">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}
