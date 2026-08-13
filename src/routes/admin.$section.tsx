import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, Bot, CheckCircle2, CircleAlert, Clock3, RefreshCw, Send } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  adminMe, checkBot, checkTelegramWebhook, getAdminCustomers, getAdminDashboard, getLogs,
  getPlans, getSettings, getSubscriptions, getTransactions, registerTelegramWebhook,
} from "@/lib/admin.functions";

const valid = new Set(["dashboard", "customers", "plans", "subscriptions", "payments", "telegram", "analytics", "logs", "settings"]);

export const Route = createFileRoute("/admin/$section")({
  beforeLoad: async ({ params }) => {
    if (!valid.has(params.section)) throw redirect({ to: "/admin/$section", params: { section: "dashboard" } });
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/admin/login" });
    try { await adminMe(); } catch { throw redirect({ to: "/admin/login" }); }
  },
  head: ({ params }) => ({ meta: [
    { title: `${params.section[0]?.toUpperCase()}${params.section.slice(1)} | Admin Console` },
    { name: "description", content: `Platform owner ${params.section} administration.` },
    { property: "og:title", content: `Admin ${params.section}` },
    { property: "og:description", content: "Secure Telegram Promotion Platform administration." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AdminSection,
});

type AnyData = Record<string, any>;

function AdminSection() {
  const { section } = Route.useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setError("");
    try {
      const loaders: Record<string, () => Promise<any>> = {
        dashboard: getAdminDashboard, analytics: getAdminDashboard,
        customers: () => getAdminCustomers({ data: {} }), plans: getPlans,
        subscriptions: getSubscriptions, payments: getTransactions,
        telegram: getSettings, settings: getSettings,
        logs: () => getLogs({ data: { kind: "system" } }),
      };
      setData(await loaders[section]?.());
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load this section."); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, [section]);
  return <AdminShell active={section}>
    <header className="mb-7"><p className="text-xs font-semibold uppercase text-primary">Platform operations</p><h1 className="mt-2 text-3xl font-semibold capitalize">{section}</h1></header>
    {error && <div className="mb-5 border-l-2 border-destructive bg-card p-4 text-sm text-destructive">{error}</div>}
    {busy && !data ? <p className="text-muted-foreground">Loading live data…</p> : <SectionContent section={section} data={data} reload={load} />}
  </AdminShell>;
}

function SectionContent({ section, data, reload }: { section: string; data: any; reload: () => Promise<void> }) {
  if (section === "dashboard" || section === "analytics") return <Dashboard data={data} />;
  if (section === "telegram") return <TelegramHealth data={data} reload={reload} />;
  if (section === "settings") return <SettingsPanel data={data} />;
  const rows = Array.isArray(data) ? data : [];
  return <div className="overflow-hidden border border-border bg-card">
    <div className="flex items-center justify-between border-b border-border p-4"><p className="font-medium">{rows.length} records</p><Button variant="secondary" size="sm" onClick={reload}><RefreshCw />Refresh</Button></div>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><tbody>{rows.map((row: AnyData, index: number) => <tr key={row.id ?? index} className="border-b border-border last:border-0"><td className="p-4 font-medium">{row.email ?? row.name ?? row.action ?? row.code ?? `Record ${index + 1}`}</td><td className="p-4 text-muted-foreground">{row.status ?? row.created_at ?? row.price_usd ?? "—"}</td><td className="p-4 text-right text-muted-foreground">{row.plan_id ? "Plan assigned" : row.network ?? row.resource ?? ""}</td></tr>)}</tbody></table></div>
    {!rows.length && <p className="p-8 text-center text-muted-foreground">No records yet.</p>}
  </div>;
}

function Dashboard({ data }: { data: any }) {
  const totals = data?.totals ?? {};
  const labels: Record<string, string> = { customers: "Total customers", activeTenants: "Active customers", suspended: "Suspended", campaigns: "Campaigns", running: "Running", processed: "Messages processed", errors: "System errors", revenue: "Revenue (USDT)", pending: "Pending payments" };
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(labels).map(([key, label]) => <div key={key} className="border border-border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-semibold">{Number(totals[key] ?? 0).toLocaleString()}</p></div>)}</div>;
}

function TelegramHealth({ data, reload }: { data: any; reload: () => Promise<void> }) {
  const tg = data?.telegram ?? {};
  const healthy = tg.webhook_status === "HEALTHY";
  const [result, setResult] = useState("");
  async function act(kind: "bot" | "check" | "register") {
    setResult("Working…");
    const response = kind === "bot" ? await checkBot() : kind === "check" ? await checkTelegramWebhook() : await registerTelegramWebhook();
    setResult(response.ok ? "Telegram confirmed the operation." : response.error);
    await reload();
  }
  return <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
    <section className="border border-border bg-card"><div className="flex items-center justify-between border-b border-border p-5"><div><p className="text-sm text-muted-foreground">Telegram Bot Health</p><h2 className="mt-1 text-xl font-semibold">@{tg.bot_username || "unknown"}</h2></div>{healthy ? <CheckCircle2 className="size-7 text-success" /> : <CircleAlert className="size-7 text-warning" />}</div>
      <dl className="grid gap-px bg-border sm:grid-cols-2">{[["Bot token", tg.token_configured ? "Configured" : "Missing"],["Webhook", tg.webhook_status],["Pending updates", tg.webhook_pending_updates],["Last successful update", tg.last_successful_update_at ? new Date(tg.last_successful_update_at).toLocaleString() : "None yet"],["Last check", tg.webhook_last_checked_at ? new Date(tg.webhook_last_checked_at).toLocaleString() : "Not checked"],["Last error", tg.webhook_last_error || "None"]].map(([k,v]) => <div key={String(k)} className="bg-card p-4"><dt className="text-xs uppercase text-muted-foreground">{k}</dt><dd className="mt-2 break-words text-sm font-medium">{String(v ?? "—")}</dd></div>)}</dl>
      <div className="p-5"><p className="break-all text-xs text-muted-foreground">{tg.webhook_url || "Webhook URL not stored yet"}</p>{result && <p className="mt-3 text-sm">{result}</p>}<div className="mt-5 flex flex-wrap gap-2"><Button onClick={() => act("register")}><Send />Register webhook</Button><Button variant="secondary" onClick={() => act("check")}><Activity />Check webhook</Button><Button variant="secondary" onClick={() => act("bot")}><Bot />Check bot</Button></div></div>
    </section>
    <section className="border border-border bg-card p-5"><Clock3 className="size-5 text-primary" /><h2 className="mt-4 font-semibold">Mini App</h2><p className="mt-2 break-all text-sm text-muted-foreground">{tg.mini_app_url || "Not configured"}</p><p className="mt-5 text-sm text-muted-foreground">Saving Telegram settings validates the bot and re-registers the production webhook.</p></section>
  </div>;
}

function SettingsPanel({ data }: { data: any }) {
  const payments = data?.payments ?? {};
  return <div className="grid gap-4 md:grid-cols-2"><section className="border border-border bg-card p-5"><h2 className="font-semibold">Payments</h2><p className="mt-4 text-sm text-muted-foreground">Status: {payments.payment_enabled ? "Enabled" : "Disabled"}</p><p className="mt-2 text-sm text-muted-foreground">Network: {payments.network || "TRC20"}</p><p className="mt-2 text-sm text-muted-foreground">Wallet: {payments.wallet_address || "Not configured"}</p></section><section className="border border-border bg-card p-5"><h2 className="font-semibold">Registration</h2><p className="mt-4 text-sm text-muted-foreground">{data?.registration?.registration_enabled === false ? "Disabled" : "Enabled"}</p></section></div>;
}