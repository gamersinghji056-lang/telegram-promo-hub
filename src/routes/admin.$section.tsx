/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, Bot, CheckCircle2, CircleAlert, Clock3, RefreshCw, Send } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  adminMe,
  checkBot,
  checkTelegramWebhook,
  getAdminCustomers,
  getAdminDashboard,
  getLogs,
  getPlans,
  getSettings,
  getSubscriptions,
  getTransactions,
  registerTelegramWebhook,
  savePlan,
  saveSettings,
  setCustomerStatus,
} from "@/lib/admin.functions";

const valid = new Set([
  "dashboard",
  "customers",
  "plans",
  "subscriptions",
  "payments",
  "telegram",
  "analytics",
  "logs",
  "settings",
]);

export const Route = createFileRoute("/admin/$section")({
  beforeLoad: async ({ params }) => {
    if (!valid.has(params.section))
      throw redirect({ to: "/admin/$section", params: { section: "dashboard" } });
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/admin/login" });
    try {
      await adminMe();
    } catch {
      throw redirect({ to: "/admin/login" });
    }
  },
  head: ({ params }) => ({
    meta: [
      { title: `${params.section[0]?.toUpperCase()}${params.section.slice(1)} | Admin Console` },
      { name: "description", content: `Platform owner ${params.section} administration.` },
      { property: "og:title", content: `Admin ${params.section}` },
      { property: "og:description", content: "Secure Telegram Promotion Platform administration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminSection,
});

type AnyData = Record<string, any>;

function AdminSection() {
  const { section } = Route.useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    try {
      const loaders: Record<string, () => Promise<any>> = {
        dashboard: getAdminDashboard,
        analytics: getAdminDashboard,
        customers: () => getAdminCustomers({ data: {} }),
        plans: getPlans,
        subscriptions: getSubscriptions,
        payments: getTransactions,
        telegram: getSettings,
        settings: getSettings,
        logs: () => getLogs({ data: { kind: "system" } }),
      };
      setData(await loaders[section]?.());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load this section.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, [section]);
  return (
    <AdminShell active={section}>
      <header className="mb-7">
        <p className="text-xs font-semibold uppercase text-primary">Platform operations</p>
        <h1 className="mt-2 text-3xl font-semibold capitalize">{section}</h1>
      </header>
      {error && (
        <div className="mb-5 border-l-2 border-destructive bg-card p-4 text-sm text-destructive">
          {error}
        </div>
      )}
      {busy && !data ? (
        <p className="text-muted-foreground">Loading live data…</p>
      ) : (
        <SectionContent section={section} data={data} reload={load} />
      )}
    </AdminShell>
  );
}

function SectionContent({
  section,
  data,
  reload,
}: {
  section: string;
  data: any;
  reload: () => Promise<void>;
}) {
  if (section === "dashboard" || section === "analytics") return <Dashboard data={data} />;
  if (section === "customers")
    return <CustomersAdmin rows={Array.isArray(data) ? data : []} reload={reload} />;
  if (section === "plans")
    return <PlansAdmin rows={Array.isArray(data) ? data : []} reload={reload} />;
  if (section === "telegram") return <TelegramHealth data={data} reload={reload} />;
  if (section === "settings") return <SettingsPanel data={data} />;
  const rows = Array.isArray(data) ? data : [];
  return (
    <div className="overflow-hidden border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-4">
        <p className="font-medium">{rows.length} records</p>
        <Button variant="secondary" size="sm" onClick={reload}>
          <RefreshCw />
          Refresh
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <tbody>
            {rows.map((row: AnyData, index: number) => (
              <tr key={row["id"] ?? index} className="border-b border-border last:border-0">
                <td className="p-4 font-medium">
                  {row["email"] ??
                    row["name"] ??
                    row["action"] ??
                    row["code"] ??
                    `Record ${index + 1}`}
                </td>
                <td className="p-4 text-muted-foreground">
                  {row["status"] ?? row["created_at"] ?? row["price_usd"] ?? "—"}
                </td>
                <td className="p-4 text-right text-muted-foreground">
                  {row["plan_id"] ? "Plan assigned" : (row["network"] ?? row["resource"] ?? "")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="p-8 text-center text-muted-foreground">No records yet.</p>}
    </div>
  );
}

function CustomersAdmin({ rows, reload }: { rows: AnyData[]; reload: () => Promise<void> }) {
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  async function changeStatus(id: string, status: "ACTIVE" | "SUSPENDED") {
    setWorking(id);
    setError("");
    try {
      await setCustomerStatus({ data: { id, status } });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update customer status.");
    } finally {
      setWorking("");
    }
  }
  return (
    <div className="overflow-hidden border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-4">
        <p className="font-medium">{rows.length} customers</p>
        <Button variant="secondary" size="sm" onClick={reload}>
          <RefreshCw />
          Refresh
        </Button>
      </div>
      {error && <p className="border-b border-border p-4 text-sm text-destructive">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-4">Customer</th>
              <th className="p-4">Plan</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const tenant = row["tenants"] as AnyData | null;
              const active = row["status"] === "ACTIVE" && tenant?.["status"] !== "SUSPENDED";
              return (
                <tr key={row["id"]} className="border-t border-border">
                  <td className="p-4">
                    <p className="font-medium">{row["email"]}</p>
                    <p className="text-xs text-muted-foreground">
                      {row["telegram_username"]
                        ? `@${row["telegram_username"]}`
                        : (row["name"] ?? "No Telegram link")}
                    </p>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {((tenant?.["plans"] as AnyData | undefined)?.["name"] as string | undefined) ??
                      "No plan"}
                  </td>
                  <td className="p-4">
                    <span className={active ? "text-success" : "text-warning"}>
                      {active ? "ACTIVE" : "SUSPENDED"}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {active ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={working === row["id"]}
                        onClick={() => changeStatus(row["id"], "SUSPENDED")}
                      >
                        Suspend
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={working === row["id"]}
                        onClick={() => changeStatus(row["id"], "ACTIVE")}
                      >
                        Activate
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="p-8 text-center text-muted-foreground">No customers yet.</p>}
    </div>
  );
}

function PlansAdmin({ rows, reload }: { rows: AnyData[]; reload: () => Promise<void> }) {
  const empty = {
    code: "",
    name: "",
    price_usd: 0,
    duration_days: 30,
    max_connections: 1,
    max_groups: 10,
    max_campaigns: 5,
    max_audience: 500,
    monthly_message_limit: 500,
    sort_order: rows.length + 1,
    is_active: true,
  };
  const [draft, setDraft] = useState<AnyData>(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key: string, value: unknown) => setDraft((d) => ({ ...d, [key]: value }));
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await savePlan({ data: { plan: draft } });
      setDraft(empty);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save plan.");
    } finally {
      setBusy(false);
    }
  }
  const numeric = [
    "price_usd",
    "duration_days",
    "max_connections",
    "max_groups",
    "max_campaigns",
    "max_audience",
    "monthly_message_limit",
    "sort_order",
  ];
  return (
    <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
      <section className="overflow-hidden border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-4">
          <p className="font-medium">{rows.length} plans</p>
          <Button variant="secondary" size="sm" onClick={() => setDraft(empty)}>
            New plan
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <tbody>
              {rows.map((row) => (
                <tr key={row["id"]} className="border-b border-border last:border-0">
                  <td className="p-4">
                    <p className="font-medium">{row["name"]}</p>
                    <p className="text-xs text-muted-foreground">{row["code"]}</p>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {row["price_usd"]} USDT / {row["duration_days"]} days
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {row["monthly_message_limit"]} messages
                  </td>
                  <td className="p-4 text-right">
                    <Button variant="secondary" size="sm" onClick={() => setDraft(row)}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <form onSubmit={submit} className="border border-border bg-card p-5">
        <h2 className="font-semibold">{draft["id"] ? "Edit plan" : "Create plan"}</h2>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Code
            <input
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              value={String(draft["code"] ?? "")}
              onChange={(e) => set("code", e.target.value)}
              required
            />
          </label>
          <label className="text-sm">
            Name
            <input
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              value={String(draft["name"] ?? "")}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </label>
          {numeric.map((key) => (
            <label key={key} className="text-sm capitalize">
              {key.replace(/_/g, " ")}
              <input
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                type="number"
                min={0}
                value={Number(draft[key] ?? 0)}
                onChange={(e) => set(key, Number(e.target.value))}
              />
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft["is_active"] !== false}
              onChange={(e) => set("is_active", e.target.checked)}
            />{" "}
            Active
          </label>
        </div>
        <Button type="submit" className="mt-5 w-full" disabled={busy}>
          {busy ? "Saving..." : "Save plan"}
        </Button>
      </form>
    </div>
  );
}

function Dashboard({ data }: { data: any }) {
  const totals = data?.totals ?? {};
  const labels: Record<string, string> = {
    customers: "Total customers",
    activeTenants: "Active customers",
    suspended: "Suspended",
    campaigns: "Campaigns",
    running: "Running",
    processed: "Messages processed",
    errors: "System errors",
    revenue: "Revenue (USDT)",
    pending: "Pending payments",
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Object.entries(labels).map(([key, label]) => (
        <div key={key} className="border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-3 text-3xl font-semibold">{Number(totals[key] ?? 0).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

function TelegramHealth({ data, reload }: { data: any; reload: () => Promise<void> }) {
  const tg = data?.telegram ?? {};
  const healthy = tg.webhook_status === "HEALTHY";
  const [result, setResult] = useState("");
  const [miniAppUrl, setMiniAppUrl] = useState(String(tg.mini_app_url ?? ""));
  const [savingUrl, setSavingUrl] = useState(false);
  async function act(kind: "bot" | "check" | "register") {
    setResult("Working…");
    const response =
      kind === "bot"
        ? await checkBot()
        : kind === "check"
          ? await checkTelegramWebhook()
          : await registerTelegramWebhook();
    setResult(response.ok ? "Telegram confirmed the operation." : response.error);
    await reload();
  }
  async function saveMiniApp(event: React.FormEvent) {
    event.preventDefault();
    setSavingUrl(true);
    setResult("");
    try {
      await saveSettings({ data: { key: "telegram", value: { mini_app_url: miniAppUrl } } });
      setResult("Mini App URL saved.");
      await reload();
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Could not save Mini App URL.");
    } finally {
      setSavingUrl(false);
    }
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <section className="border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <p className="text-sm text-muted-foreground">Telegram Bot Health</p>
            <h2 className="mt-1 text-xl font-semibold">@{tg.bot_username || "unknown"}</h2>
          </div>
          {healthy ? (
            <CheckCircle2 className="size-7 text-success" />
          ) : (
            <CircleAlert className="size-7 text-warning" />
          )}
        </div>
        <dl className="grid gap-px bg-border sm:grid-cols-2">
          {[
            ["Bot token", tg.token_configured ? "Configured" : "Missing"],
            ["Webhook", tg.webhook_status],
            ["Pending updates", tg.webhook_pending_updates],
            [
              "Last successful update",
              tg.last_successful_update_at
                ? new Date(tg.last_successful_update_at).toLocaleString()
                : "None yet",
            ],
            [
              "Last check",
              tg.webhook_last_checked_at
                ? new Date(tg.webhook_last_checked_at).toLocaleString()
                : "Not checked",
            ],
            ["Last error", tg.webhook_last_error || "None"],
          ].map(([k, v]) => (
            <div key={String(k)} className="bg-card p-4">
              <dt className="text-xs uppercase text-muted-foreground">{k}</dt>
              <dd className="mt-2 break-words text-sm font-medium">{String(v ?? "—")}</dd>
            </div>
          ))}
        </dl>
        <div className="p-5">
          <p className="break-all text-xs text-muted-foreground">
            {tg.webhook_url || "Webhook URL not stored yet"}
          </p>
          {result && <p className="mt-3 text-sm">{result}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => act("register")}>
              <Send />
              Register webhook
            </Button>
            <Button variant="secondary" onClick={() => act("check")}>
              <Activity />
              Check webhook
            </Button>
            <Button variant="secondary" onClick={() => act("bot")}>
              <Bot />
              Check bot
            </Button>
          </div>
        </div>
      </section>
      <section className="border border-border bg-card p-5">
        <Clock3 className="size-5 text-primary" />
        <h2 className="mt-4 font-semibold">Mini App</h2>
        <p className="mt-2 break-all text-sm text-muted-foreground">
          {tg.mini_app_url || "Not configured"}
        </p>
        <form onSubmit={saveMiniApp} className="mt-5">
          <label className="text-sm font-medium">
            Mini App URL
            <input
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              value={miniAppUrl}
              onChange={(e) => setMiniAppUrl(e.target.value)}
              placeholder="https://example.com/mini-app"
            />
          </label>
          <Button type="submit" className="mt-3 w-full" disabled={savingUrl}>
            {savingUrl ? "Saving..." : "Save Mini App URL"}
          </Button>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">
          Must point to the existing /mini-app route.
        </p>
      </section>
    </div>
  );
}

function SettingsPanel({ data }: { data: any }) {
  const payments = data?.payments ?? {};
  const registration = data?.registration ?? {};
  const [paymentDraft, setPaymentDraft] = useState({
    payment_enabled: Boolean(payments.payment_enabled),
    network: String(payments.network || "TRC20"),
    wallet_address: String(payments.wallet_address || ""),
  });
  const [registrationDraft, setRegistrationDraft] = useState({
    registration_enabled: registration.registration_enabled !== false,
    email_verification_enabled: Boolean(registration.email_verification_enabled),
    default_plan_code: String(registration.default_plan_code || "FREE"),
  });
  const [result, setResult] = useState("");
  async function save(key: "payments" | "registration", value: Record<string, unknown>) {
    setResult("");
    try {
      await saveSettings({ data: { key, value } });
      setResult("Settings saved.");
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Could not save settings.");
    }
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {result && (
        <p className="md:col-span-2 border-l-2 border-primary bg-card p-4 text-sm">{result}</p>
      )}
      <form
        className="border border-border bg-card p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save("payments", paymentDraft);
        }}
      >
        <h2 className="font-semibold">Payments</h2>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={paymentDraft.payment_enabled}
            onChange={(e) => setPaymentDraft((d) => ({ ...d, payment_enabled: e.target.checked }))}
          />{" "}
          Payment enabled
        </label>
        <label className="mt-4 block text-sm">
          Network
          <input
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5"
            value={paymentDraft.network}
            onChange={(e) => setPaymentDraft((d) => ({ ...d, network: e.target.value }))}
          />
        </label>
        <label className="mt-4 block text-sm">
          USDT wallet
          <input
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5"
            value={paymentDraft.wallet_address}
            onChange={(e) => setPaymentDraft((d) => ({ ...d, wallet_address: e.target.value }))}
          />
        </label>
        <Button type="submit" className="mt-5 w-full">
          Save payments
        </Button>
      </form>
      <form
        className="border border-border bg-card p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save("registration", registrationDraft);
        }}
      >
        <h2 className="font-semibold">Registration</h2>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={registrationDraft.registration_enabled}
            onChange={(e) =>
              setRegistrationDraft((d) => ({ ...d, registration_enabled: e.target.checked }))
            }
          />{" "}
          Registration enabled
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={registrationDraft.email_verification_enabled}
            onChange={(e) =>
              setRegistrationDraft((d) => ({ ...d, email_verification_enabled: e.target.checked }))
            }
          />{" "}
          Email verification enabled
        </label>
        <label className="mt-4 block text-sm">
          Default plan code
          <input
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5"
            value={registrationDraft.default_plan_code}
            onChange={(e) =>
              setRegistrationDraft((d) => ({
                ...d,
                default_plan_code: e.target.value.toUpperCase(),
              }))
            }
          />
        </label>
        <Button type="submit" className="mt-5 w-full">
          Save registration
        </Button>
      </form>
    </div>
  );
}
