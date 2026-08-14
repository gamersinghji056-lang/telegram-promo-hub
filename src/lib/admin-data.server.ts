import { db, getSetting, setSetting, logAdmin } from "./db.server";
import { hashPassword } from "./security.server";
import {
  checkWebhook,
  registerWebhook,
  syncBotIdentity,
  telegramSettings,
} from "./telegram.server";

export async function assertSuperAdmin(userId: string) {
  const client = db();
  const { data } = await client
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (data) return true;

  // Bootstrap: the very first admin account claims the super admin role.
  const { count } = await client
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "super_admin");
  if ((count ?? 0) === 0) {
    await client.from("user_roles").insert({ user_id: userId, role: "super_admin" });
    await logAdmin({ admin_user_id: userId, action: "SUPER_ADMIN_BOOTSTRAPPED" });
    return true;
  }
  throw new Error("FORBIDDEN");
}

export async function adminDashboard() {
  const client = db();
  const c = async (table: string, filters: Record<string, unknown> = {}) => {
    let q = client.from(table).select("id", { count: "exact", head: true });
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    return (await q).count ?? 0;
  };
  const [customers, activeTenants, suspended, plans, campaigns, running, errors] =
    await Promise.all([
      c("customers"),
      c("tenants", { status: "ACTIVE" }),
      c("tenants", { status: "SUSPENDED" }),
      c("plans", { is_active: true }),
      c("campaigns"),
      c("campaigns", { status: "RUNNING" }),
      c("system_logs", { status: "FAILED" }),
    ]);

  const { data: paid } = await client
    .from("billing_transactions")
    .select("amount, created_at, status");
  const revenue = (paid ?? [])
    .filter((t) => t.status === "CONFIRMED")
    .reduce((a, t) => a + Number(t.amount), 0);
  const pending = (paid ?? []).filter((t) => t.status === "PENDING").length;

  const { data: allCampaigns } = await client
    .from("campaigns")
    .select("completed_count, failed_count, created_at");
  const processed = (allCampaigns ?? []).reduce(
    (a, x) => a + (x.completed_count ?? 0) + (x.failed_count ?? 0),
    0,
  );

  const { data: tenants } = await client.from("tenants").select("created_at");
  const days = [...Array(14)].map((_, i) =>
    new Date(Date.now() - (13 - i) * 86400_000).toISOString().slice(0, 10),
  );
  const series = (rows: { at: string }[]) =>
    days.map((d) => ({
      day: d.slice(5),
      value: rows.filter((r) => r.at.slice(0, 10) === d).length,
    }));

  return {
    totals: {
      customers,
      activeTenants,
      suspended,
      plans,
      campaigns,
      running,
      processed,
      errors,
      revenue,
      pending,
    },
    charts: {
      customers: series((tenants ?? []).map((t) => ({ at: t.created_at as string }))),
      campaigns: series((allCampaigns ?? []).map((t) => ({ at: t.created_at as string }))),
      revenue: days.map((d) => ({
        day: d.slice(5),
        value: (paid ?? [])
          .filter((t) => t.status === "CONFIRMED" && (t.created_at as string).slice(0, 10) === d)
          .reduce((a, t) => a + Number(t.amount), 0),
      })),
    },
  };
}

export async function adminCustomers(search?: string) {
  let q = db()
    .from("customers")
    .select(
      "id, email, name, status, created_at, telegram_username, tenant_id, tenants(name, status, plan_expires_at, messages_used, plans(name, code, monthly_message_limit))",
    )
    .order("created_at", { ascending: false })
    .limit(300);
  if (search) q = q.ilike("email", `%${search}%`);
  const { data } = await q;
  return data ?? [];
}

export async function adminCustomerDetail(customerId: string) {
  const client = db();
  const { data: customer } = await client
    .from("customers")
    .select("*, tenants(*, plans(*))")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) throw new Error("Customer not found.");
  const tenantId = customer.tenant_id as string;
  const [connections, groups, campaigns, transactions, logs, subscription] = await Promise.all([
    client.from("telegram_connections").select("*").eq("tenant_id", tenantId),
    client
      .from("discovered_groups")
      .select("id, title, username, status")
      .eq("tenant_id", tenantId)
      .limit(100),
    client
      .from("campaigns")
      .select("id, name, type, status, total_targets, completed_count, failed_count, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50),
    client
      .from("billing_transactions")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50),
    client
      .from("system_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(50),
    client
      .from("subscriptions")
      .select("*, plans(name)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    customer,
    connections: connections.data ?? [],
    groups: groups.data ?? [],
    campaigns: campaigns.data ?? [],
    transactions: transactions.data ?? [],
    logs: logs.data ?? [],
    subscription: subscription.data,
  };
}

export async function adminSetCustomerStatus(
  adminId: string,
  customerId: string,
  status: "ACTIVE" | "SUSPENDED",
) {
  const client = db();
  const { data: customer } = await client
    .from("customers")
    .select("tenant_id, email")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) throw new Error("Customer not found.");
  await client
    .from("customers")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", customerId);
  await client
    .from("tenants")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", customer.tenant_id);
  if (status === "SUSPENDED")
    await client.from("customer_sessions").delete().eq("customer_id", customerId);
  await logAdmin({
    admin_user_id: adminId,
    action: `CUSTOMER_${status}`,
    resource: customer.email as string,
  });
  return { ok: true };
}

export async function adminChangePlan(adminId: string, customerId: string, planId: string) {
  const client = db();
  const { data: customer } = await client
    .from("customers")
    .select("tenant_id, email")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) throw new Error("Customer not found.");
  const { data: plan } = await client.from("plans").select("*").eq("id", planId).maybeSingle();
  if (!plan) throw new Error("Plan not found.");
  const expires = new Date(Date.now() + Number(plan.duration_days) * 86400_000).toISOString();
  await client
    .from("tenants")
    .update({ plan_id: planId, plan_expires_at: expires })
    .eq("id", customer.tenant_id);
  await client.from("subscriptions").insert({
    tenant_id: customer.tenant_id,
    plan_id: planId,
    status: "ACTIVE",
    payment_status: "MANUAL",
    expires_at: expires,
  });
  await client.from("notifications").insert({
    tenant_id: customer.tenant_id,
    title: "Plan updated",
    body: `Your plan is now ${plan.name}.`,
    kind: "SUCCESS",
  });
  await logAdmin({
    admin_user_id: adminId,
    action: "CUSTOMER_PLAN_CHANGED",
    resource: customer.email as string,
    details: { plan: plan.code },
  });
  return { ok: true };
}

export async function adminResetPassword(adminId: string, customerId: string, newPassword: string) {
  if (newPassword.length < 8) throw new Error("Password must be at least 8 characters.");
  const client = db();
  await client
    .from("customers")
    .update({
      password_hash: await hashPassword(newPassword),
      updated_at: new Date().toISOString(),
    })
    .eq("id", customerId);
  await client.from("customer_sessions").delete().eq("customer_id", customerId);
  await logAdmin({
    admin_user_id: adminId,
    action: "CUSTOMER_PASSWORD_RESET",
    resource: customerId,
  });
  return { ok: true };
}

export async function adminSaveNotes(adminId: string, customerId: string, notes: string) {
  const client = db();
  const { data: customer } = await client
    .from("customers")
    .select("tenant_id")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) throw new Error("Customer not found.");
  await client.from("tenants").update({ notes }).eq("id", customer.tenant_id);
  await logAdmin({ admin_user_id: adminId, action: "CUSTOMER_NOTE", resource: customerId });
  return { ok: true };
}

export async function adminPlans() {
  const { data } = await db().from("plans").select("*").order("sort_order");
  return data ?? [];
}

export async function adminSavePlan(adminId: string, plan: Record<string, unknown>) {
  const client = db();
  const row: Record<string, unknown> = {
    code: String(plan["code"] ?? "")
      .trim()
      .toUpperCase(),
    name: String(plan["name"] ?? "").trim(),
    price_usd: Number(plan["price_usd"] ?? 0),
    duration_days: Number(plan["duration_days"] ?? 30),
    max_connections: Number(plan["max_connections"] ?? 1),
    max_groups: Number(plan["max_groups"] ?? 10),
    max_campaigns: Number(plan["max_campaigns"] ?? 5),
    max_audience: Number(plan["max_audience"] ?? 500),
    monthly_message_limit: Number(plan["monthly_message_limit"] ?? 500),
    is_active: plan["is_active"] !== false,
    sort_order: Number(plan["sort_order"] ?? 0),
    updated_at: new Date().toISOString(),
  };
  if (!row["code"] || !row["name"]) throw new Error("Plan code and name are required.");
  for (const key of [
    "price_usd",
    "duration_days",
    "max_connections",
    "max_groups",
    "max_campaigns",
    "max_audience",
    "monthly_message_limit",
    "sort_order",
  ]) {
    if (!Number.isFinite(row[key] as number) || Number(row[key]) < 0)
      throw new Error(`Invalid plan value: ${key}`);
  }
  const id = plan["id"] as string | undefined;
  if (id) {
    const { error } = await client.from("plans").update(row).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    delete row["id"];
    const { error } = await client.from("plans").insert(row);
    if (error) throw new Error(error.message);
  }
  await logAdmin({
    admin_user_id: adminId,
    action: id ? "PLAN_UPDATED" : "PLAN_CREATED",
    resource: String(plan["code"] ?? ""),
  });
  return adminPlans();
}

export async function adminSubscriptions() {
  const { data } = await db()
    .from("subscriptions")
    .select("*, plans(name, price_usd), tenants(name, id, customers(email))")
    .order("created_at", { ascending: false })
    .limit(300);
  return data ?? [];
}

export async function adminTransactions() {
  const { data } = await db()
    .from("billing_transactions")
    .select("*, plans(name), tenants(name)")
    .order("created_at", { ascending: false })
    .limit(300);
  return data ?? [];
}

export async function adminUpdateTransaction(
  adminId: string,
  id: string,
  status: string,
  txHash?: string,
) {
  const client = db();
  const { data: tx } = await client
    .from("billing_transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!tx) throw new Error("Transaction not found.");
  await client
    .from("billing_transactions")
    .update({
      status,
      tx_hash: txHash ?? tx.tx_hash,
      paid_at: status === "CONFIRMED" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (status === "CONFIRMED" && tx.plan_id) {
    const { data: plan } = await client
      .from("plans")
      .select("*")
      .eq("id", tx.plan_id)
      .maybeSingle();
    if (plan) {
      const expires = new Date(Date.now() + Number(plan.duration_days) * 86400_000).toISOString();
      await client
        .from("tenants")
        .update({ plan_id: plan.id, plan_expires_at: expires })
        .eq("id", tx.tenant_id);
      await client.from("subscriptions").insert({
        tenant_id: tx.tenant_id,
        plan_id: plan.id,
        status: "ACTIVE",
        payment_status: "PAID",
        expires_at: expires,
      });
    }
  }
  await logAdmin({
    admin_user_id: adminId,
    action: "TRANSACTION_UPDATED",
    resource: id,
    details: { status },
  });
  return { ok: true };
}

export type PlatformSettings = {
  general: {
    system_name?: string;
    logo_url?: string;
    support_email?: string;
    support_telegram?: string;
    maintenance_mode?: boolean;
  };
  registration: {
    registration_enabled?: boolean;
    email_verification_enabled?: boolean;
    default_plan_code?: string;
  };
  payments: { payment_enabled?: boolean; network?: string; wallet_address?: string };
  telegram: Awaited<ReturnType<typeof telegramSettings>>;
  discovery: { provider_url?: string; provider_key?: string };
};

export async function adminSettings(): Promise<PlatformSettings> {
  const [general, registration, payments, telegram, discovery] = await Promise.all([
    getSetting<PlatformSettings["general"]>("general"),
    getSetting<PlatformSettings["registration"]>("registration"),
    getSetting<PlatformSettings["payments"]>("payments"),
    telegramSettings(),
    getSetting<PlatformSettings["discovery"]>("discovery"),
  ]);
  return { general, registration, payments, telegram, discovery };
}

export async function adminSaveSettings(
  adminId: string,
  key: "general" | "registration" | "payments" | "telegram" | "discovery",
  value: Record<string, unknown>,
) {
  if (key === "telegram" && typeof value["mini_app_url"] === "string") {
    value["mini_app_url"] = normalizeMiniAppUrl(value["mini_app_url"]);
  }
  const current = await getSetting(key);
  await setSetting(key, { ...current, ...value });
  await logAdmin({ admin_user_id: adminId, action: "SETTINGS_UPDATED", resource: key });
  return adminSettings();
}

function normalizeMiniAppUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Mini App URL must be a valid absolute URL.");
  }
  const isLocal = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) {
    throw new Error("Mini App URL must use HTTPS, except localhost during development.");
  }
  if (url.username || url.password) throw new Error("Mini App URL must not contain credentials.");
  if (!["/mini-app", "/mini-app/"].includes(url.pathname)) {
    throw new Error("Mini App URL must point to the existing /mini-app route.");
  }
  url.pathname = "/mini-app";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export async function adminCheckBot() {
  const res = await syncBotIdentity();
  return res.ok
    ? { ok: true as const, username: (res.result as { username: string }).username }
    : { ok: false as const, error: res.error };
}

export async function adminCheckWebhook() {
  return checkWebhook();
}

export async function adminRegisterWebhook(adminId: string) {
  const result = await registerWebhook();
  await logAdmin({
    admin_user_id: adminId,
    action: result.ok ? "TELEGRAM_WEBHOOK_REGISTERED" : "TELEGRAM_WEBHOOK_REGISTRATION_FAILED",
    resource: "telegram",
    details: result.ok
      ? { status: result.result.status, url: result.result.url }
      : { error: result.error },
  });
  return result;
}

export async function adminLogs(kind: "system" | "admin", search?: string) {
  const client = db();
  if (kind === "admin") {
    const { data } = await client
      .from("admin_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    return data ?? [];
  }
  let q = client
    .from("system_logs")
    .select("*, customers(email), tenants(name)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (search) q = q.ilike("action", `%${search}%`);
  const { data } = await q;
  return data ?? [];
}

export async function adminCreateCustomer(
  adminId: string,
  email: string,
  password: string,
  name?: string,
) {
  const { registerCustomer } = await import("./customer-auth.server");
  const res = await registerCustomer({ email, password, name: name ?? null });
  if (!res.ok) throw new Error(res.error);
  await logAdmin({ admin_user_id: adminId, action: "CUSTOMER_CREATED", resource: email });
  return { ok: true };
}
