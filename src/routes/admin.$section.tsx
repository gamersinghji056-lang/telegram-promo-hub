/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
import { createFileRoute, redirect } from "@tanstack/react-router";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Activity, Bot, CheckCircle2, CircleAlert, Clock3, RefreshCw, Send, Trash2, UserPlus } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { supabaseAuthHeaders, withAdminAuthTimeout } from "@/integrations/supabase/auth-attacher";
import {
  adminMe,
  changeCustomerPlan,
  checkBot,
  checkTelegramWebhook,
  createCustomer,
  deleteCustomer,
  forceLogoutCustomer,
  getAdminCustomers,
  getAdminCustomer,
  getAdminDashboard,
  getAdminNotifications,
  getRegistration,
  getLogs,
  getPlans,
  getSettings,
  getSubscriptions,
  getTransactions,
  getUsage,
  grantCustomerPlan,
  grantPremiumEmoji,
  registerTelegramWebhook,
  resetCustomerPassword,
  resetUsage,
  savePlan,
  saveQuotaOverride,
  saveRegistration,
  saveSettings,
  sendAdminNotification,
  setCustomerStatus,
  updateSubscription,
  updateTransaction,
} from "@/lib/admin.functions";

const valid = new Set([
  "dashboard",
  "customers",
  "plans",
  "subscriptions",
  "payments",
  "telegram",
  "analytics",
  "usage",
  "notifications",
  "registration",
  "logs",
  "settings",
]);

function statusTone(status?: string) {
  if (["PAID", "CONFIRMED", "ACTIVE", "SUCCESS", "HEALTHY"].includes(status ?? "")) return "text-success";
  if (["FAILED", "ERROR", "CANCELLED", "EXPIRED", "UNDERPAID", "LATE_PAYMENT"].includes(status ?? "")) return "text-destructive";
  if (["PAYMENT_DETECTED", "CONFIRMING", "OVERPAID", "REVIEW_REQUIRED", "PENDING"].includes(status ?? "")) return "text-warning";
  return "text-muted-foreground";
}

export const Route = createFileRoute("/admin/$section")({
  beforeLoad: async ({ params }) => {
    if (!valid.has(params.section))
      throw redirect({ to: "/admin/$section", params: { section: "dashboard" } });
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/admin/login" });
    try {
      await withAdminAuthTimeout(adminMe({ headers: await supabaseAuthHeaders() }));
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
        usage: getUsage,
        notifications: getAdminNotifications,
        registration: getRegistration,
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
  if (section === "subscriptions")
    return <SubscriptionsAdmin rows={Array.isArray(data) ? data : []} reload={reload} />;
  if (section === "payments")
    return <PaymentsAdmin data={data ?? { invoices: [], legacyTransactions: [], monitor: {} }} reload={reload} />;
  if (section === "usage")
    return <UsageAdmin rows={Array.isArray(data) ? data : []} reload={reload} />;
  if (section === "notifications")
    return <NotificationsAdmin data={data ?? { customers: [], notifications: [] }} reload={reload} />;
  if (section === "registration")
    return <RegistrationAdmin data={data ?? { settings: {}, plans: [], stats: {} }} reload={reload} />;
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
  const [detail, setDetail] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  async function changeStatus(id: string, status: "ACTIVE" | "SUSPENDED") {
    if (status === "SUSPENDED" && !confirm("Suspend this customer?")) return;
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
  async function openDetail(id: string) {
    setWorking(id);
    setError("");
    try {
      const [customerDetail, planRows] = await Promise.all([
        getAdminCustomer({ data: { id } }),
        getPlans(),
      ]);
      setDetail(customerDetail);
      setPlans(planRows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load customer detail.");
    } finally {
      setWorking("");
    }
  }
  async function customerAction(action: string) {
    const customer = detail?.customer;
    if (!customer) return;
    setWorking(action);
    setError("");
    try {
      if (action === "FORCE_LOGOUT") {
        if (!confirm("Force logout this customer?")) return;
        await forceLogoutCustomer({ data: { id: customer.id } });
      }
      if (action === "DELETE") {
        const confirmation = prompt(`Type DELETE USER PERMANENTLY or ${customer.email} to delete this user.`);
        if (!confirmation) return;
        await deleteCustomer({ data: { id: customer.id, confirmation } });
        setDetail(null);
        await reload();
        return;
      }
      if (action === "CHANGE_PLAN") {
        const code = prompt(`Enter plan code: ${plans.map((p) => p.code).join(", ")}`);
        const plan = plans.find((p) => String(p.code).toUpperCase() === String(code).toUpperCase());
        if (!plan) throw new Error("Plan not found.");
        await changeCustomerPlan({ data: { id: customer.id, planId: plan.id } });
      }
      if (action === "GRANT_PLAN") {
        const code = prompt(`Enter plan code to grant: ${plans.map((p) => p.code).join(", ")}`);
        const plan = plans.find((p) => String(p.code).toUpperCase() === String(code).toUpperCase());
        if (!plan) throw new Error("Plan not found.");
        const duration = prompt("Duration days: 7, 30, 90, 365, NO_EXPIRY, or CUSTOM", "30") ?? "30";
        const expiresAt = duration === "CUSTOM" ? prompt("Custom expiry date (YYYY-MM-DD)") : null;
        const reason = prompt("Reason/note") ?? "Manual grant";
        await grantCustomerPlan({ data: { customerId: customer.id, planId: plan.id, duration, expiresAt, reason } });
      }
      if (action === "UNLIMITED") {
        const duration = prompt("Custom unlimited duration: 7, 30, 90, 365, NO_EXPIRY, or CUSTOM", "NO_EXPIRY") ?? "NO_EXPIRY";
        const expiresAt = duration === "CUSTOM" ? prompt("Custom expiry date (YYYY-MM-DD)") : null;
        const reason = prompt("Reason/note", "Custom unlimited grant") ?? "Custom unlimited grant";
        await grantCustomerPlan({ data: { customerId: customer.id, duration, expiresAt, reason, unlimited: true } });
      }
      if (action === "PREMIUM_EMOJI") {
        const expiresAt = prompt("Premium Emoji expiry date (YYYY-MM-DD) or blank for 30 days", "") || null;
        const reason = prompt("Reason/note", "Admin granted Premium Emoji") ?? "Admin granted Premium Emoji";
        await grantPremiumEmoji({ data: { tenantId: customer.tenant_id, expiresAt, reason } });
      }
      if (action === "REVOKE_PREMIUM_EMOJI") {
        if (!confirm("Revoke Premium Emoji for this customer?")) return;
        const reason = prompt("Reason/note", "Admin revoked Premium Emoji") ?? "Admin revoked Premium Emoji";
        await grantPremiumEmoji({ data: { tenantId: customer.tenant_id, revoke: true, reason } });
      }
      await reload();
      await openDetail(customer.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Customer action failed.");
    } finally {
      setWorking("");
    }
  }
  return (
    <div className="space-y-4">
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
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={working === row["id"]}
                      onClick={() => void openDetail(row["id"])}
                    >
                      View
                    </Button>{" "}
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
    {detail ? (
      <section className="border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{detail.customer.name ?? detail.customer.email}</h2>
            <p className="text-sm text-muted-foreground">
              {detail.customer.email} {detail.customer.telegram_username ? `@${detail.customer.telegram_username}` : ""}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setDetail(null)}>Close</Button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {usageCards(detail.usage).map(([label, used, limit]) => (
            <UsageCard key={label} label={label} used={used} limit={limit} />
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="border border-border bg-background p-3 text-sm">
            <p className="text-xs uppercase text-muted-foreground">Current Plan</p>
            <p className="mt-1 font-semibold">{detail.usage?.plan?.name ?? "TEST"}</p>
            <p className="text-xs text-muted-foreground">
              {detail.usage?.expired ? "TEST fallback" : detail.subscription?.payment_status ?? "ACTIVE"}
              {detail.subscription?.expires_at ? ` until ${new Date(detail.subscription.expires_at).toLocaleDateString()}` : " · No expiry"}
            </p>
          </div>
          <div className="border border-border bg-background p-3 text-sm">
            <p className="text-xs uppercase text-muted-foreground">Premium Emoji</p>
            <p className={detail.premiumEmoji?.active ? "mt-1 font-semibold text-success" : "mt-1 font-semibold text-muted-foreground"}>
              {detail.premiumEmoji?.active ? "Active" : "Inactive"}
            </p>
            <p className="text-xs text-muted-foreground">
              {detail.premiumEmoji?.entitlement?.expires_at ? `Until ${new Date(detail.premiumEmoji.entitlement.expires_at).toLocaleDateString()}` : "No active expiry"}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void customerAction("CHANGE_PLAN")}>Change Plan</Button>
          <Button size="sm" variant="secondary" onClick={() => void customerAction("GRANT_PLAN")}>Grant Free/Manual</Button>
          <Button size="sm" variant="secondary" onClick={() => void customerAction("UNLIMITED")}>Grant Unlimited</Button>
          <Button size="sm" variant="secondary" onClick={() => void customerAction("PREMIUM_EMOJI")}>Grant Premium Emoji</Button>
          <Button size="sm" variant="secondary" onClick={() => void customerAction("REVOKE_PREMIUM_EMOJI")}>Revoke Premium Emoji</Button>
          <Button size="sm" variant="secondary" onClick={() => void customerAction("FORCE_LOGOUT")}>Force Logout</Button>
          <Button size="sm" variant="secondary" onClick={() => changeStatus(detail.customer.id, "SUSPENDED")}>Suspend</Button>
          <Button size="sm" onClick={() => changeStatus(detail.customer.id, "ACTIVE")}>Activate</Button>
          <Button size="sm" variant="secondary" onClick={() => {
            const password = prompt("New password, at least 8 characters");
            if (password) {
              setWorking("reset-password");
              resetCustomerPassword({ data: { id: detail.customer.id, password } })
                .then(reload)
                .finally(() => setWorking(""));
            }
          }}>Reset Password</Button>
          <Button size="sm" variant="destructive" onClick={() => void customerAction("DELETE")}>
            <Trash2 className="size-4" /> Delete User
          </Button>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <DetailList title="Recent Transactions" rows={detail.transactions} fields={["status", "amount", "created_at"]} />
          <DetailList title="Recent Invoices" rows={detail.invoices} fields={["product_code", "status", "payable_amount", "tx_hash"]} />
          <DetailList title="Recent Campaigns" rows={detail.campaigns} fields={["name", "status", "total_targets"]} />
          <DetailList title="Admin Notes/Actions" rows={detail.adminLogs} fields={["action", "resource", "created_at"]} />
        </div>
      </section>
    ) : null}
    </div>
  );
}

function usageCards(usage: any): [string, number, number | null][] {
  const c = usage?.counts ?? {};
  const l = usage?.limits ?? {};
  return [
    ["Sessions", c.sessions ?? 0, l.max_connections ?? null],
    ["Campaigns", c.active_campaigns ?? 0, l.max_active_campaigns ?? null],
    ["Groups", c.saved_groups ?? 0, l.max_saved_groups ?? null],
    ["Groups Found", c.groups_found ?? 0, l.monthly_groups_found_limit ?? null],
    ["Users Found", c.audience_found ?? 0, l.monthly_audience_found_limit ?? null],
    ["Messages", c.promotion_messages ?? 0, l.monthly_message_limit ?? null],
    ["DM", c.dm_messages ?? 0, l.monthly_dm_message_limit ?? null],
    ["Categories", c.categories ?? 0, l.max_categories ?? null],
    ["Writable Checks", c.writable_checks ?? 0, l.monthly_writable_check_limit ?? null],
    ["Sendable Checks", c.sendable_checks ?? 0, l.monthly_sendable_check_limit ?? null],
  ];
}

function limitText(limit: number | null | undefined) {
  return limit == null ? "Unlimited" : Number(limit).toLocaleString();
}

function UsageCard({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit == null ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const tone = pct >= 90 ? "bg-destructive" : pct >= 80 ? "bg-warning" : "bg-primary";
  return (
    <div className="border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold">{label}</span>
        <span>{Number(used).toLocaleString()} / {limitText(limit)}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${tone}`} style={{ width: `${limit == null ? 100 : pct}%` }} />
      </div>
    </div>
  );
}

function DetailList({ title, rows, fields }: { title: string; rows: AnyData[]; fields: string[] }) {
  return (
    <div className="border border-border bg-background">
      <p className="border-b border-border p-3 text-sm font-semibold">{title}</p>
      {(rows ?? []).slice(0, 6).map((row, index) => (
        <div key={row.id ?? index} className="border-b border-border p-3 text-xs last:border-0">
          {fields.map((field) => (
            <p key={field} className="truncate">
              <span className="text-muted-foreground">{field.replace(/_/g, " ")}:</span>{" "}
              {String(row[field] ?? "")}
            </p>
          ))}
        </div>
      ))}
      {!rows?.length ? <p className="p-3 text-xs text-muted-foreground">No records.</p> : null}
    </div>
  );
}

function PlansAdmin({ rows, reload }: { rows: AnyData[]; reload: () => Promise<void> }) {
  const empty = {
    code: "",
    name: "",
    description: "",
    price_usd: 0,
    duration_days: 30,
    max_connections: 1,
    max_active_campaigns: 1,
    max_saved_groups: 20,
    monthly_groups_found_limit: 20,
    monthly_audience_found_limit: 50,
    monthly_message_limit: 50,
    monthly_dm_message_limit: 20,
    max_categories: 1,
    monthly_writable_check_limit: 20,
    monthly_sendable_check_limit: 10,
    analytics_level: "basic",
    scheduling_enabled: false,
    session_health_level: "basic",
    sort_order: rows.length + 1,
    is_active: true,
    is_public: true,
    is_custom: false,
  };
  const [draft, setDraft] = useState<AnyData>(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key: string, value: unknown) => setDraft((d) => ({ ...d, [key]: value }));
  async function submit(event: FormEvent) {
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
    "max_active_campaigns",
    "max_saved_groups",
    "monthly_groups_found_limit",
    "monthly_audience_found_limit",
    "monthly_message_limit",
    "monthly_dm_message_limit",
    "max_categories",
    "monthly_writable_check_limit",
    "monthly_sendable_check_limit",
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
                    ${row["price_usd"]} / {row["duration_days"]} days
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {row["is_public"] ? "PUBLIC PLAN" : "CUSTOM/PRIVATE PLAN"} · {row["is_active"] ? "Active" : "Inactive"}
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
          <label className="sm:col-span-2 text-sm">
            Description
            <input
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
              value={String(draft["description"] ?? "")}
              onChange={(e) => set("description", e.target.value)}
            />
          </label>
          {numeric.map((key) => (
            <label key={key} className="text-sm capitalize">
              {key.replace(/_/g, " ")} {key !== "price_usd" && key !== "duration_days" && key !== "max_connections" && key !== "sort_order" ? "(blank = unlimited)" : ""}
              <input
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                type={key === "price_usd" || key === "duration_days" || key === "max_connections" || key === "sort_order" ? "number" : "text"}
                min={0}
                value={draft[key] == null ? "" : String(draft[key])}
                onChange={(e) => set(key, e.target.value === "" ? null : Number(e.target.value))}
              />
            </label>
          ))}
          <label className="text-sm">
            Analytics level
            <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" value={String(draft["analytics_level"] ?? "basic")} onChange={(e) => set("analytics_level", e.target.value)}>
              <option value="basic">basic</option>
              <option value="full">full</option>
            </select>
          </label>
          <label className="text-sm">
            Session health
            <select className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" value={String(draft["session_health_level"] ?? "basic")} onChange={(e) => set("session_health_level", e.target.value)}>
              <option value="disabled">disabled</option>
              <option value="basic">basic</option>
              <option value="full">full</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft["is_active"] !== false}
              onChange={(e) => set("is_active", e.target.checked)}
            />{" "}
            Active
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft["is_public"] !== false}
              onChange={(e) => set("is_public", e.target.checked)}
            />{" "}
            Public billing plan
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft["is_custom"] === true}
              onChange={(e) => set("is_custom", e.target.checked)}
            />{" "}
            Custom/private plan
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft["scheduling_enabled"] === true}
              onChange={(e) => set("scheduling_enabled", e.target.checked)}
            />{" "}
            Scheduling enabled
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
    testUsers: "TEST users",
    plusUsers: "PLUS users",
    proUsers: "PRO users",
    enterpriseUsers: "ENTERPRISE users",
    manualUnlimited: "Manual / Unlimited",
    activeSubscriptions: "Active subscriptions",
    expiringSoon: "Expiring in 7 days",
    expiredSubscriptions: "Expired",
    activeSessions: "Active Telegram sessions",
    unhealthySessions: "Unhealthy sessions",
    messagesThisMonth: "Messages this month",
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

function SubscriptionsAdmin({ rows, reload }: { rows: AnyData[]; reload: () => Promise<void> }) {
  async function act(id: string, action: "EXTEND" | "EXPIRE" | "CANCEL" | "GRANT_AGAIN") {
    if ((action === "EXPIRE" || action === "CANCEL") && !confirm(`${action} this subscription?`)) return;
    const days = action === "EXTEND" || action === "GRANT_AGAIN" ? Number(prompt("Days", "30") ?? 30) : undefined;
    const reason = prompt("Reason/note") ?? "";
    await updateSubscription({ data: { id, action, days, reason } });
    await reload();
  }
  return (
    <AdminTable
      rows={rows}
      columns={["Customer", "Plan", "Status", "Payment", "Expiry", "Actions"]}
      render={(row) => {
        const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
        const plan = Array.isArray(row.plans) ? row.plans[0] : row.plans;
        const customer = Array.isArray(tenant?.customers) ? tenant.customers[0] : tenant?.customers;
        return [
          customer?.email ?? tenant?.name ?? row.tenant_id,
          plan?.name ?? row.plan_id,
          row.status,
          row.payment_status,
          row.no_expiry ? "No expiry" : row.expires_at ? new Date(row.expires_at).toLocaleDateString() : "",
          <div className="flex flex-wrap justify-end gap-1" key="actions">
            <Button size="sm" variant="secondary" onClick={() => void act(row.id, "EXTEND")}>Extend</Button>
            <Button size="sm" variant="secondary" onClick={() => void act(row.id, "EXPIRE")}>Expire</Button>
            <Button size="sm" variant="secondary" onClick={() => void act(row.id, "CANCEL")}>Cancel</Button>
            <Button size="sm" onClick={() => void act(row.id, "GRANT_AGAIN")}>Grant Again</Button>
          </div>,
        ];
      }}
    />
  );
}

function PaymentsAdmin({ data, reload }: { data: AnyData; reload: () => Promise<void> }) {
  const rows = Array.isArray(data?.invoices) ? data.invoices : [];
  const legacy = Array.isArray(data?.legacyTransactions) ? data.legacyTransactions : [];
  const monitor = data?.monitor ?? {};
  async function update(row: AnyData, status: string) {
    if ((status === "CONFIRMED" || status === "PAID") && !confirm("Confirm this payment and activate the selected product?")) return;
    const txHash = status === "CONFIRMED" || status === "PAID" ? prompt("Transaction hash/reference", row.tx_hash ?? "") ?? "" : row.tx_hash;
    await updateTransaction({ data: { id: row.id, status, txHash } });
    await reload();
  }
  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-4">
        {[
          ["Blockchain Monitor", monitor.status ?? "UNKNOWN"],
          ["Last Scan", monitor.lastSuccessAt ? new Date(monitor.lastSuccessAt).toLocaleString() : "Never"],
          ["Pending Invoices", monitor.pendingInvoices ?? 0],
          ["Provider Key", monitor.apiKeyConfigured ? "Configured" : "Public/limited"],
        ].map(([label, value]) => (
          <div key={String(label)} className="border border-border bg-card p-4">
            <p className="text-xs uppercase text-muted-foreground">{label}</p>
            <p className="mt-2 break-words font-semibold">{String(value)}</p>
          </div>
        ))}
      </section>
    <AdminTable
      rows={rows}
      columns={["Invoice", "Customer", "Product", "Amount", "Status", "Blockchain", "Actions"]}
      render={(row) => {
        const plan = Array.isArray(row.plans) ? row.plans[0] : row.plans;
        const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
        const customer = Array.isArray(tenant?.customers) ? tenant.customers[0] : tenant?.customers;
        return [
          <div key="invoice">
            <p className="font-mono text-xs">{row.invoice_number ?? row.id}</p>
            <p className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleString()}</p>
          </div>,
          customer?.email ?? tenant?.name ?? row.tenant_id,
          row.product_type === "ADDON" ? row.product_code : plan?.name ?? row.product_code,
          <div key="amount">
            <p>{Number(row.base_price ?? 0).toFixed(2)} base</p>
            <p className="font-semibold">{Number(row.payable_amount ?? 0).toFixed(6)} USDT</p>
          </div>,
          <span key="status" className={statusTone(row.status)}>{row.status}</span>,
          <div key="chain" className="max-w-xs text-xs">
            <p>{row.blockchain_status ?? "Waiting"}</p>
            <p className="break-all">{row.from_address ?? ""}</p>
            {row.tx_hash ? <a className="text-primary hover:underline" href={`https://tronscan.org/#/transaction/${encodeURIComponent(row.tx_hash)}`} target="_blank" rel="noreferrer">TronScan</a> : null}
          </div>,
          <div className="flex flex-wrap justify-end gap-1" key="actions">
            {["REVIEW_REQUIRED", "PAID", "CANCELLED"].map((status) => (
              <Button key={status} size="sm" variant={status === "PAID" ? "default" : "secondary"} onClick={() => void update(row, status)}>
                {status === "PAID" ? "Confirm manually" : status}
              </Button>
            ))}
          </div>,
        ];
      }}
    />
    {legacy.length ? (
      <section>
        <h2 className="mb-2 font-semibold">Legacy Transactions</h2>
        <AdminTable
          rows={legacy}
          columns={["Tenant", "Plan", "Amount", "Status", "Created"]}
          render={(row) => {
            const plan = Array.isArray(row.plans) ? row.plans[0] : row.plans;
            const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
            return [tenant?.name ?? row.tenant_id, plan?.name ?? row.plan_id, `${row.amount} ${row.currency}`, row.status, new Date(row.created_at).toLocaleString()];
          }}
        />
      </section>
    ) : null}
    </div>
  );
}

function UsageAdmin({ rows, reload }: { rows: AnyData[]; reload: () => Promise<void> }) {
  async function reset(tenantId: string) {
    if (!confirm("Reset this customer's current monthly usage?")) return;
    await resetUsage({ data: { tenantId, reason: prompt("Reason", "Admin reset") ?? "" } });
    await reload();
  }
  async function override(row: AnyData) {
    const customer = row.customer ?? {};
    const raw = prompt("Override max sessions for this customer (blank = unlimited plan quota, hard cap 20). Leave cancel to skip.");
    if (raw === null) return;
    const reason = prompt("Reason", "Admin quota override") ?? "";
    await saveQuotaOverride({
      data: {
        tenantId: customer.tenant_id,
        fields: {
          max_connections: raw.trim() === "" ? null : Number(raw),
        },
        reason,
      },
    });
    await reload();
  }
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const customer = row.customer ?? {};
        return (
          <section key={customer.id} className="border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{customer.email}</p>
                <p className="text-xs text-muted-foreground">{row.usage?.plan?.name ?? "TEST"}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button size="sm" variant="secondary" onClick={() => void override(row)}>Override Quota</Button>
                <Button size="sm" variant="secondary" onClick={() => void reset(customer.tenant_id)}>Reset Usage</Button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {usageCards(row.usage).map(([label, used, limit]) => (
                <UsageCard key={label} label={label} used={used} limit={limit} />
              ))}
            </div>
          </section>
        );
      })}
      {!rows.length ? <p className="text-sm text-muted-foreground">No usage rows.</p> : null}
    </div>
  );
}

function NotificationsAdmin({ data, reload }: { data: any; reload: () => Promise<void> }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"INFO" | "SUCCESS" | "WARNING" | "ERROR">("INFO");
  const [link, setLink] = useState("");
  async function submit(all = false) {
    await sendAdminNotification({ data: { customerIds: selected, all, title, message, type, link: link || null } });
    setTitle("");
    setMessage("");
    setSelected([]);
    await reload();
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
      <section className="border border-border bg-card p-5">
        <h2 className="font-semibold">Send in-app notification</h2>
        <input className="mt-4 w-full rounded-md border border-input bg-background px-3 py-2" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2" placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} />
        <select className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2" value={type} onChange={(e) => setType(e.target.value as any)}>
          {["INFO", "SUCCESS", "WARNING", "ERROR"].map((kind) => <option key={kind}>{kind}</option>)}
        </select>
        <input className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2" placeholder="/mini-app/billing" value={link} onChange={(e) => setLink(e.target.value)} />
        <div className="mt-4 max-h-52 overflow-auto border border-border">
          {(data.customers ?? []).map((customer: any) => (
            <label key={customer.id} className="flex items-center gap-2 border-b border-border p-2 text-sm">
              <input type="checkbox" checked={selected.includes(customer.id)} onChange={(e) => setSelected((ids) => e.target.checked ? [...ids, customer.id] : ids.filter((id) => id !== customer.id))} />
              {customer.email}
            </label>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Button disabled={!title || !message || !selected.length} onClick={() => void submit(false)}>Send Selected</Button>
          <Button variant="secondary" disabled={!title || !message} onClick={() => void submit(true)}>Announce All</Button>
        </div>
      </section>
      <DetailList title="Recent notifications" rows={data.notifications ?? []} fields={["title", "kind", "created_at"]} />
    </div>
  );
}

function RegistrationAdmin({ data, reload }: { data: any; reload: () => Promise<void> }) {
  const settings = data?.settings ?? {};
  const plans = data?.plans ?? [];
  const stats = data?.stats ?? {};
  const [draft, setDraft] = useState({
    registration_enabled: settings.registration_enabled !== false,
    email_verification_enabled: Boolean(settings.email_verification_enabled),
    default_plan_code: String(settings.default_plan_code ?? "TEST"),
    default_duration_days: Number(settings.default_duration_days ?? 30),
    new_user_status: String(settings.new_user_status ?? "ACTIVE"),
    welcome_message: String(settings.welcome_message ?? ""),
  });
  const [userDraft, setUserDraft] = useState({
    name: "",
    email: "",
    password: "",
    planId: String(plans[0]?.id ?? ""),
    durationDays: Number(settings.default_duration_days ?? 30),
    status: "ACTIVE",
    unlimited: false,
    reason: "Admin-created customer",
  });
  const [result, setResult] = useState("");
  const set = (key: string, value: unknown) => setDraft((d) => ({ ...d, [key]: value }));
  const setUser = (key: string, value: unknown) => setUserDraft((d) => ({ ...d, [key]: value }));
  async function saveConfig(event: FormEvent) {
    event.preventDefault();
    setResult("");
    try {
      const next = await saveRegistration({ data: { value: draft } });
      setDraft(next.settings);
      setResult("Registration settings saved.");
      await reload();
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Could not save registration settings.");
    }
  }
  async function submitUser(event: FormEvent) {
    event.preventDefault();
    setResult("");
    try {
      await createCustomer({
        data: {
          name: userDraft.name || null,
          email: userDraft.email,
          password: userDraft.password,
          planId: userDraft.planId,
          durationDays: userDraft.durationDays,
          status: userDraft.status as "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED",
          unlimited: userDraft.unlimited,
          reason: userDraft.reason,
        },
      });
      setUserDraft((d) => ({ ...d, name: "", email: "", password: "", unlimited: false }));
      setResult("Customer created.");
      await reload();
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Could not create customer.");
    }
  }
  const statLabels: Record<string, string> = {
    totalUsers: "Total Users",
    newToday: "New Today",
    newThisMonth: "New This Month",
    active: "Active",
    suspended: "Suspended",
    pendingApprovals: "Pending Approvals",
  };
  return (
    <div className="space-y-5">
      {result ? <p className="border-l-2 border-primary bg-card p-4 text-sm">{result}</p> : null}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {Object.entries(statLabels).map(([key, label]) => (
          <div key={key} className="border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{Number(stats[key] ?? 0).toLocaleString()}</p>
          </div>
        ))}
      </section>
      <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <form onSubmit={saveConfig} className="border border-border bg-card p-5">
          <h2 className="font-semibold">Registration Status</h2>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.registration_enabled} onChange={(e) => set("registration_enabled", e.target.checked)} />
            Enable new registrations
          </label>
          <label className="mt-4 block text-sm">
            Default Plan
            <select className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5" value={draft.default_plan_code} onChange={(e) => set("default_plan_code", e.target.value)}>
              {plans.map((plan: any) => <option key={plan.id} value={plan.code}>{plan.name} ({plan.code})</option>)}
            </select>
          </label>
          <label className="mt-4 block text-sm">
            Default Access Duration
            <input className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5" type="number" min={1} value={draft.default_duration_days} onChange={(e) => set("default_duration_days", Number(e.target.value))} />
          </label>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draft.email_verification_enabled} onChange={(e) => set("email_verification_enabled", e.target.checked)} />
            Email verification
          </label>
          <label className="mt-4 block text-sm">
            New User Status
            <select className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5" value={draft.new_user_status} onChange={(e) => set("new_user_status", e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
            </select>
          </label>
          <label className="mt-4 block text-sm">
            Welcome Notification
            <textarea className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2.5" value={draft.welcome_message} onChange={(e) => set("welcome_message", e.target.value)} />
          </label>
          <Button type="submit" className="mt-5 w-full">Save Registration</Button>
        </form>
        <form onSubmit={submitUser} className="border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            <h2 className="font-semibold">Create User</h2>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input className="rounded-md border border-input bg-background px-3 py-2.5" placeholder="Name" value={userDraft.name} onChange={(e) => setUser("name", e.target.value)} />
            <input className="rounded-md border border-input bg-background px-3 py-2.5" placeholder="Email" value={userDraft.email} onChange={(e) => setUser("email", e.target.value)} required />
            <input className="rounded-md border border-input bg-background px-3 py-2.5" placeholder="Temporary Password" type="password" value={userDraft.password} onChange={(e) => setUser("password", e.target.value)} required />
            <select className="rounded-md border border-input bg-background px-3 py-2.5" value={userDraft.planId} onChange={(e) => setUser("planId", e.target.value)} required>
              {plans.map((plan: any) => <option key={plan.id} value={plan.id}>{plan.name} ({plan.code})</option>)}
            </select>
            <input className="rounded-md border border-input bg-background px-3 py-2.5" type="number" min={0} value={userDraft.durationDays} onChange={(e) => setUser("durationDays", Number(e.target.value))} />
            <select className="rounded-md border border-input bg-background px-3 py-2.5" value={userDraft.status} onChange={(e) => setUser("status", e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={userDraft.unlimited} onChange={(e) => setUser("unlimited", e.target.checked)} />
            Grant custom unlimited entitlement
          </label>
          <input className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2.5" placeholder="Reason" value={userDraft.reason} onChange={(e) => setUser("reason", e.target.value)} />
          <Button type="submit" className="mt-5 w-full">+ Create User</Button>
        </form>
      </div>
    </div>
  );
}

function AdminTable({ rows, columns, render }: { rows: AnyData[]; columns: string[]; render: (row: AnyData) => ReactNode[] }) {
  return (
    <div className="overflow-hidden border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>{columns.map((c) => <th key={c} className="p-4">{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id ?? index} className="border-t border-border">
                {render(row).map((cell, i) => <td key={i} className="p-4">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length ? <p className="p-8 text-center text-muted-foreground">No records yet.</p> : null}
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
  async function saveMiniApp(event: FormEvent) {
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
  const [paymentDraft, setPaymentDraft] = useState({
    payment_enabled: Boolean(payments.payment_enabled),
    network: String(payments.network || "TRC20"),
    wallet_address: String(payments.wallet_address || ""),
  });
  const [result, setResult] = useState("");
  async function save(key: "payments", value: Record<string, unknown>) {
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
    </div>
  );
}
