import { db, getSetting, setSetting, logAdmin } from "./db.server";
import { hashPassword } from "./security.server";
import { normalizeEmail, validEmail } from "./customer-auth.server";
import {
  checkWebhook,
  registerWebhook,
  syncBotIdentity,
  telegramSettings,
} from "./telegram.server";
import {
  PLAN_LIMIT_KEYS,
  ensureDefaultPlans,
  tenantUsageDashboard,
} from "./entitlements.server";

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

function normalizeLimitInput(value: unknown) {
  if (value === null || value === undefined || value === "" || value === "unlimited") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("Plan limits must be non-negative numbers or blank for unlimited.");
  return Math.floor(n);
}

function expiryFromGrant(input: { duration?: string; expiresAt?: string | null; noExpiry?: boolean }) {
  if (input.noExpiry || input.duration === "NO_EXPIRY") return null;
  if (input.duration === "CUSTOM") {
    if (!input.expiresAt) throw new Error("Custom expiry date is required.");
    return new Date(input.expiresAt).toISOString();
  }
  const days = Number(input.duration ?? 30);
  if (!Number.isFinite(days) || days < 1) throw new Error("Invalid grant duration.");
  return new Date(Date.now() + days * 86400_000).toISOString();
}

async function customerById(customerId: string) {
  const { data } = await db()
    .from("customers")
    .select("id, tenant_id, email, name, status")
    .eq("id", customerId)
    .maybeSingle();
  if (!data) throw new Error("Customer not found.");
  return data;
}

async function tenantPlanCount(code: string) {
  const { count } = await db()
    .from("tenants")
    .select("id, plans!inner(code)", { count: "exact", head: true })
    .eq("plans.code", code);
  return count ?? 0;
}

export async function adminDashboard() {
  await ensureDefaultPlans();
  const client = db();
  const c = async (table: string, filters: Record<string, unknown> = {}) => {
    let q = client.from(table).select("id", { count: "exact", head: true });
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    return (await q).count ?? 0;
  };
  const [
    customers,
    activeTenants,
    suspended,
    plans,
    campaigns,
    running,
    errors,
    testUsers,
    plusUsers,
    proUsers,
    enterpriseUsers,
    manualUnlimited,
    activeSubscriptions,
    expiredSubscriptions,
    activeSessions,
    unhealthySessions,
  ] =
    await Promise.all([
      c("customers"),
      c("tenants", { status: "ACTIVE" }),
      c("tenants", { status: "SUSPENDED" }),
      c("plans", { is_active: true }),
      c("campaigns"),
      c("campaigns", { status: "RUNNING" }),
      c("system_logs", { status: "FAILED" }),
      tenantPlanCount("TEST"),
      tenantPlanCount("PLUS"),
      tenantPlanCount("PRO"),
      tenantPlanCount("ENTERPRISE"),
      c("tenant_entitlement_overrides", { override_type: "UNLIMITED" }),
      c("subscriptions", { status: "ACTIVE" }),
      c("subscriptions", { status: "EXPIRED" }),
      c("telegram_connections", { status: "CONNECTED" }),
      client
        .from("telegram_connections")
        .select("id", { count: "exact", head: true })
        .or("status.eq.ERROR,health_score.lt.50")
        .then((r) => r.count ?? 0),
    ]);

  const { data: paid } = await client
    .from("billing_transactions")
    .select("amount, created_at, status");
  const revenue = (paid ?? [])
    .filter((t) => t.status === "CONFIRMED")
    .reduce((a, t) => a + Number(t.amount), 0);
  const pending = (paid ?? []).filter((t) => t.status === "PENDING").length;
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const { data: usageRows } = await client
    .from("monthly_usage")
    .select("promotion_messages, dm_messages")
    .eq("period_start", monthStart);
  const messagesThisMonth = (usageRows ?? []).reduce(
    (sum, row) => sum + Number(row.promotion_messages ?? 0) + Number(row.dm_messages ?? 0),
    0,
  );
  const now = new Date();
  const soon = new Date(Date.now() + 7 * 86400_000).toISOString();
  const { count: expiringSoon } = await client
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("status", "ACTIVE")
    .not("expires_at", "is", null)
    .lte("expires_at", soon)
    .gte("expires_at", now.toISOString());

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
      testUsers,
      plusUsers,
      proUsers,
      enterpriseUsers,
      manualUnlimited,
      activeSubscriptions,
      expiringSoon: expiringSoon ?? 0,
      expiredSubscriptions,
      activeSessions,
      unhealthySessions,
      messagesThisMonth,
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
  const [connections, groups, campaigns, transactions, logs, subscription, usage, adminLogs] = await Promise.all([
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
      .select("*, plans(*)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    tenantUsageDashboard(tenantId),
    client
      .from("admin_logs")
      .select("*")
      .in("resource", [customer.email as string, customerId])
      .order("created_at", { ascending: false })
      .limit(25),
  ]);
  return {
    customer,
    connections: connections.data ?? [],
    groups: groups.data ?? [],
    campaigns: campaigns.data ?? [],
    transactions: transactions.data ?? [],
    logs: logs.data ?? [],
    subscription: subscription.data,
    usage,
    adminLogs: adminLogs.data ?? [],
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
    action: status === "ACTIVE" ? "CUSTOMER_ACTIVATED" : "CUSTOMER_SUSPENDED",
    resource: customer.email as string,
  });
  return { ok: true };
}

export async function adminChangePlan(adminId: string, customerId: string, planId: string) {
  const client = db();
  const customer = await customerById(customerId);
  const { data: plan } = await client.from("plans").select("*").eq("id", planId).maybeSingle();
  if (!plan) throw new Error("Plan not found.");
  const expires = Number(plan.duration_days ?? 0) > 0
    ? new Date(Date.now() + Number(plan.duration_days) * 86400_000).toISOString()
    : null;
  await client
    .from("tenants")
    .update({ plan_id: planId, plan_expires_at: expires })
    .eq("id", customer.tenant_id);
  await client.from("subscriptions").insert({
    tenant_id: customer.tenant_id,
    plan_id: planId,
    status: "ACTIVE",
    payment_status: "MANUAL",
    granted_by: adminId,
    grant_reason: "Admin plan change",
    no_expiry: expires === null,
    expires_at: expires,
  });
  await client.from("tenant_entitlement_overrides").delete().eq("tenant_id", customer.tenant_id);
  await client.from("notifications").insert({
    tenant_id: customer.tenant_id,
    title: "Plan updated",
    body: `Your plan is now ${plan.name}.`,
    kind: "SUCCESS",
  });
  await logAdmin({
    admin_user_id: adminId,
    action: "PLAN_CHANGED",
    resource: customer.email as string,
    details: { plan: plan.code },
  });
  return { ok: true };
}

export async function adminGrantPlan(
  adminId: string,
  input: {
    customerId: string;
    planId?: string | null;
    duration?: string;
    expiresAt?: string | null;
    noExpiry?: boolean;
    reason?: string | null;
    unlimited?: boolean;
  },
) {
  const client = db();
  const customer = await customerById(input.customerId);
  let planId = input.planId ?? null;
  if (!planId) {
    const { data: enterprise } = await client.from("plans").select("id").eq("code", "ENTERPRISE").maybeSingle();
    planId = enterprise?.id ?? null;
  }
  if (!planId) throw new Error("Select a plan.");
  const { data: plan } = await client.from("plans").select("*").eq("id", planId).maybeSingle();
  if (!plan) throw new Error("Plan not found.");
  const expires = expiryFromGrant({
    duration: input.duration,
    expiresAt: input.expiresAt,
    noExpiry: input.noExpiry,
  });
  await client
    .from("tenants")
    .update({ plan_id: planId, plan_expires_at: expires, updated_at: new Date().toISOString() })
    .eq("id", customer.tenant_id);
  await client.from("subscriptions").insert({
    tenant_id: customer.tenant_id,
    plan_id: planId,
    status: input.unlimited ? "MANUAL" : "ACTIVE",
    payment_status: "MANUAL",
    expires_at: expires,
    no_expiry: expires === null,
    granted_by: adminId,
    grant_reason: input.reason ?? "Manual grant",
    metadata: { unlimited: Boolean(input.unlimited) },
  });
  if (input.unlimited) {
    await client.from("tenant_entitlement_overrides").upsert(
      {
        tenant_id: customer.tenant_id,
        override_type: "UNLIMITED",
        max_connections: 20,
        max_active_campaigns: null,
        max_saved_groups: null,
        monthly_groups_found_limit: null,
        monthly_audience_found_limit: null,
        monthly_message_limit: null,
        monthly_dm_message_limit: null,
        max_categories: null,
        monthly_writable_check_limit: null,
        monthly_sendable_check_limit: null,
        analytics_level: "full",
        scheduling_enabled: true,
        session_health_level: "full",
        expires_at: expires,
        granted_by: adminId,
        grant_reason: input.reason ?? "Custom unlimited grant",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" },
    );
  } else {
    await client.from("tenant_entitlement_overrides").delete().eq("tenant_id", customer.tenant_id);
  }
  await client.from("notifications").insert({
    tenant_id: customer.tenant_id,
    title: "Plan updated",
    body: `Your plan has been updated to ${plan.name}.`,
    kind: "SUCCESS",
    link: "/mini-app/billing",
  });
  await logAdmin({
    admin_user_id: adminId,
    action: input.unlimited ? "CUSTOM_UNLIMITED_GRANTED" : "PLAN_GRANTED",
    resource: customer.email as string,
    details: { plan: plan.code, expires_at: expires, reason: input.reason ?? null },
  });
  return { ok: true };
}

export async function adminForceLogout(adminId: string, customerId: string) {
  const customer = await customerById(customerId);
  await db().from("customer_sessions").delete().eq("customer_id", customerId);
  await logAdmin({
    admin_user_id: adminId,
    action: "CUSTOMER_FORCE_LOGOUT",
    resource: customer.email as string,
  });
  return { ok: true };
}

export async function adminDeleteCustomer(adminId: string, customerId: string, confirmation: string) {
  const customer = await customerById(customerId);
  if (confirmation !== "DELETE USER PERMANENTLY" && confirmation !== customer.email) {
    throw new Error("Deletion confirmation did not match.");
  }
  await logAdmin({
    admin_user_id: adminId,
    action: "USER_DELETED",
    resource: customer.email as string,
    details: { customer_id: customerId, tenant_id: customer.tenant_id, name: customer.name },
  });
  const { error } = await db().from("tenants").delete().eq("id", customer.tenant_id);
  if (error) throw new Error(error.message);
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
  await ensureDefaultPlans();
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
    description: String(plan["description"] ?? "").trim(),
    price_usd: Number(plan["price_usd"] ?? 0),
    duration_days: Number(plan["duration_days"] ?? 30),
    max_connections: Math.min(20, Number(plan["max_connections"] ?? 1)),
    max_active_campaigns: normalizeLimitInput(plan["max_active_campaigns"]),
    max_saved_groups: normalizeLimitInput(plan["max_saved_groups"]),
    monthly_groups_found_limit: normalizeLimitInput(plan["monthly_groups_found_limit"]),
    monthly_audience_found_limit: normalizeLimitInput(plan["monthly_audience_found_limit"]),
    monthly_message_limit: normalizeLimitInput(plan["monthly_message_limit"]),
    monthly_dm_message_limit: normalizeLimitInput(plan["monthly_dm_message_limit"]),
    max_categories: normalizeLimitInput(plan["max_categories"]),
    monthly_writable_check_limit: normalizeLimitInput(plan["monthly_writable_check_limit"]),
    monthly_sendable_check_limit: normalizeLimitInput(plan["monthly_sendable_check_limit"]),
    max_groups: normalizeLimitInput(plan["max_saved_groups"] ?? plan["max_groups"]),
    max_campaigns: normalizeLimitInput(plan["max_active_campaigns"] ?? plan["max_campaigns"]),
    max_audience: normalizeLimitInput(plan["monthly_audience_found_limit"] ?? plan["max_audience"]),
    analytics_level: ["basic", "full"].includes(String(plan["analytics_level"])) ? String(plan["analytics_level"]) : "basic",
    scheduling_enabled: plan["scheduling_enabled"] === true,
    session_health_level: ["disabled", "basic", "full"].includes(String(plan["session_health_level"]))
      ? String(plan["session_health_level"])
      : "basic",
    is_public: plan["is_public"] !== false,
    is_custom: plan["is_custom"] === true,
    is_active: plan["is_active"] !== false,
    sort_order: Number(plan["sort_order"] ?? 0),
    updated_at: new Date().toISOString(),
  };
  if (!row["code"] || !row["name"]) throw new Error("Plan code and name are required.");
  for (const key of [
    "price_usd",
    "duration_days",
    "max_connections",
    "sort_order",
  ]) {
    if (!Number.isFinite(row[key] as number) || Number(row[key]) < 0)
      throw new Error(`Invalid plan value: ${key}`);
  }
  if (Number(row["max_connections"]) > 20) throw new Error("Plans cannot allow more than 20 sessions.");
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
    .select("*, plans(*), tenants(name, id, customers(email))")
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
      confirmed_by: status === "CONFIRMED" ? adminId : null,
      updated_at: new Date().toISOString(),
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
      await client.from("tenant_entitlement_overrides").delete().eq("tenant_id", tx.tenant_id);
      await client.from("notifications").insert({
        tenant_id: tx.tenant_id,
        title: "Payment confirmed",
        body: `Your ${plan.name} plan is now active.`,
        kind: "SUCCESS",
        link: "/mini-app/billing",
      });
    }
  }
  await logAdmin({
    admin_user_id: adminId,
    action: status === "CONFIRMED" ? "PAYMENT_CONFIRMED" : "TRANSACTION_UPDATED",
    resource: id,
    details: { status },
  });
  return { ok: true };
}

export async function adminSubscriptionAction(
  adminId: string,
  input: { id: string; action: "EXTEND" | "EXPIRE" | "CANCEL" | "GRANT_AGAIN"; days?: number; reason?: string },
) {
  const client = db();
  const { data: sub } = await client.from("subscriptions").select("*").eq("id", input.id).maybeSingle();
  if (!sub) throw new Error("Subscription not found.");
  const days = Math.max(1, Number(input.days ?? 30));
  const patch: Record<string, unknown> = {};
  if (input.action === "EXTEND" || input.action === "GRANT_AGAIN") {
    patch.status = "ACTIVE";
    patch.expires_at = new Date(Date.now() + days * 86400_000).toISOString();
    patch.cancelled_at = null;
  }
  if (input.action === "EXPIRE") {
    patch.status = "EXPIRED";
    patch.expires_at = new Date().toISOString();
  }
  if (input.action === "CANCEL") {
    patch.status = "SUSPENDED";
    patch.cancelled_at = new Date().toISOString();
  }
  const { error } = await client.from("subscriptions").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);
  if (input.action === "EXTEND" || input.action === "GRANT_AGAIN") {
    await client
      .from("tenants")
      .update({ plan_id: sub.plan_id, plan_expires_at: patch.expires_at })
      .eq("id", sub.tenant_id);
  }
  await logAdmin({
    admin_user_id: adminId,
    action:
      input.action === "EXTEND"
        ? "SUBSCRIPTION_EXTENDED"
        : input.action === "CANCEL"
          ? "SUBSCRIPTION_CANCELLED"
          : input.action === "EXPIRE"
            ? "PLAN_EXPIRED"
            : "PLAN_GRANTED",
    resource: input.id,
    details: { reason: input.reason ?? null, days },
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
    default_duration_days?: number;
    new_user_status?: "ACTIVE" | "PENDING_APPROVAL";
    welcome_message?: string;
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

export async function adminRegistration() {
  await ensureDefaultPlans();
  const client = db();
  const [settings, { data: plans }, { count: totalUsers }, { count: newToday }, { count: newThisMonth }, { count: active }, { count: suspended }, { count: pending }] =
    await Promise.all([
      getSetting<PlatformSettings["registration"]>("registration"),
      client
        .from("plans")
        .select("id, code, name, price_usd, duration_days, is_active, is_public, is_custom")
        .eq("is_active", true)
        .order("sort_order"),
      client.from("customers").select("id", { count: "exact", head: true }),
      client
        .from("customers")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())).toISOString()),
      client
        .from("customers")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()),
      client.from("customers").select("id", { count: "exact", head: true }).eq("status", "ACTIVE"),
      client.from("customers").select("id", { count: "exact", head: true }).eq("status", "SUSPENDED"),
      client.from("customers").select("id", { count: "exact", head: true }).eq("status", "PENDING_APPROVAL"),
    ]);
  return {
    settings: {
      registration_enabled: settings.registration_enabled !== false,
      email_verification_enabled: Boolean(settings.email_verification_enabled),
      default_plan_code: settings.default_plan_code ?? "TEST",
      default_duration_days: Number(settings.default_duration_days ?? 30),
      new_user_status: settings.new_user_status === "PENDING_APPROVAL" ? "PENDING_APPROVAL" : "ACTIVE",
      welcome_message: settings.welcome_message ?? "Welcome to WPAY. Your account is ready.",
    },
    plans: plans ?? [],
    stats: {
      totalUsers: totalUsers ?? 0,
      newToday: newToday ?? 0,
      newThisMonth: newThisMonth ?? 0,
      active: active ?? 0,
      suspended: suspended ?? 0,
      pendingApprovals: pending ?? 0,
    },
  };
}

export async function adminSaveRegistration(adminId: string, value: Record<string, unknown>) {
  await ensureDefaultPlans();
  const planCode = String(value["default_plan_code"] ?? "TEST").trim().toUpperCase();
  const { data: plan } = await db()
    .from("plans")
    .select("code")
    .eq("code", planCode)
    .eq("is_active", true)
    .maybeSingle();
  if (!plan) throw new Error("Default plan must be an active plan.");
  const duration = Math.max(1, Math.floor(Number(value["default_duration_days"] ?? 30)));
  const newUserStatus = value["new_user_status"] === "PENDING_APPROVAL" ? "PENDING_APPROVAL" : "ACTIVE";
  const current = await getSetting("registration");
  await setSetting("registration", {
    ...current,
    registration_enabled: value["registration_enabled"] !== false,
    email_verification_enabled: value["email_verification_enabled"] === true,
    default_plan_code: planCode,
    default_duration_days: duration,
    new_user_status: newUserStatus,
    welcome_message: String(value["welcome_message"] ?? "").trim(),
  });
  await logAdmin({
    admin_user_id: adminId,
    action: "REGISTRATION_SETTINGS_UPDATED",
    resource: "registration",
    details: { default_plan_code: planCode, default_duration_days: duration, new_user_status: newUserStatus },
  });
  return adminRegistration();
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

export async function adminUsage() {
  const { data: customers } = await db()
    .from("customers")
    .select("id, email, name, status, tenant_id, tenants(name, plans(code, name))")
    .order("created_at", { ascending: false })
    .limit(300);
  const rows = [];
  for (const customer of customers ?? []) {
    rows.push({
      customer,
      usage: await tenantUsageDashboard(customer.tenant_id as string),
    });
  }
  return rows;
}

export async function adminResetUsage(adminId: string, tenantId: string, reason?: string) {
  const { error } = await db()
    .from("monthly_usage")
    .update({
      groups_found: 0,
      audience_found: 0,
      promotion_messages: 0,
      dm_messages: 0,
      writable_checks: 0,
      sendable_checks: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);
  await logAdmin({
    admin_user_id: adminId,
    action: "USAGE_OVERRIDE",
    resource: tenantId,
    details: { reset: true, reason: reason ?? null },
  });
  return { ok: true };
}

export async function adminSaveQuotaOverride(
  adminId: string,
  input: { tenantId: string; fields: Record<string, unknown>; expiresAt?: string | null; reason?: string | null },
) {
  const row: Record<string, unknown> = {
    tenant_id: input.tenantId,
    override_type: "CUSTOM",
    expires_at: input.expiresAt ? new Date(input.expiresAt).toISOString() : null,
    granted_by: adminId,
    grant_reason: input.reason ?? "Usage override",
    updated_at: new Date().toISOString(),
  };
  for (const key of PLAN_LIMIT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input.fields, key)) row[key] = normalizeLimitInput(input.fields[key]);
  }
  if (Number(row["max_connections"] ?? 0) > 20) throw new Error("Overrides cannot allow more than 20 sessions.");
  if (input.fields["analytics_level"]) row["analytics_level"] = String(input.fields["analytics_level"]);
  if (Object.prototype.hasOwnProperty.call(input.fields, "scheduling_enabled")) {
    row["scheduling_enabled"] = input.fields["scheduling_enabled"] === true;
  }
  if (input.fields["session_health_level"]) row["session_health_level"] = String(input.fields["session_health_level"]);
  const { error } = await db().from("tenant_entitlement_overrides").upsert(row, { onConflict: "tenant_id" });
  if (error) throw new Error(error.message);
  await logAdmin({
    admin_user_id: adminId,
    action: "USAGE_OVERRIDE",
    resource: input.tenantId,
    details: { fields: input.fields, reason: input.reason ?? null },
  });
  return { ok: true };
}

export async function adminNotifications() {
  const [customers, notifications] = await Promise.all([
    db().from("customers").select("id, email, name, tenant_id, status").order("email").limit(500),
    db().from("notifications").select("*, tenants(name)").order("created_at", { ascending: false }).limit(300),
  ]);
  return { customers: customers.data ?? [], notifications: notifications.data ?? [] };
}

export async function adminSendNotification(
  adminId: string,
  input: {
    customerIds?: string[];
    all?: boolean;
    title: string;
    message: string;
    type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
    link?: string | null;
  },
) {
  const title = input.title.trim();
  if (!title) throw new Error("Notification title is required.");
  const client = db();
  let tenantIds: string[] = [];
  if (input.all) {
    const { data } = await client.from("tenants").select("id").eq("status", "ACTIVE");
    tenantIds = (data ?? []).map((row) => String(row.id));
  } else {
    const ids = [...new Set(input.customerIds ?? [])].filter(Boolean);
    if (!ids.length) throw new Error("Select at least one customer.");
    const { data } = await client.from("customers").select("tenant_id").in("id", ids);
    tenantIds = (data ?? []).map((row) => String(row.tenant_id));
  }
  if (!tenantIds.length) throw new Error("No notification recipients found.");
  const { error } = await client.from("notifications").insert(
    tenantIds.map((tenantId) => ({
      tenant_id: tenantId,
      title,
      body: input.message,
      kind: input.type,
      link: input.link ?? null,
    })),
  );
  if (error) throw new Error(error.message);
  await logAdmin({
    admin_user_id: adminId,
    action: "ADMIN_NOTIFICATION_SENT",
    resource: input.all ? "ALL" : tenantIds.join(","),
    details: { title, type: input.type, count: tenantIds.length },
  });
  return { ok: true, count: tenantIds.length };
}

export async function adminCreateCustomer(
  adminId: string,
  input: {
    email: string;
    password: string;
    name?: string | null;
    planId?: string | null;
    durationDays?: number | null;
    status?: "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED";
    unlimited?: boolean;
    reason?: string | null;
  },
) {
  await ensureDefaultPlans();
  const client = db();
  const email = normalizeEmail(input.email);
  if (!validEmail(email)) throw new Error("Enter a valid email address.");
  if (!input.password || input.password.length < 8) throw new Error("Temporary password must be at least 8 characters.");

  const { data: existing } = await client.from("customers").select("id").eq("email", email).maybeSingle();
  if (existing) throw new Error("An account with this email already exists.");

  const planQuery = input.planId
    ? client.from("plans").select("*").eq("id", input.planId).maybeSingle()
    : client.from("plans").select("*").eq("code", "TEST").maybeSingle();
  const { data: plan } = await planQuery;
  if (!plan) throw new Error("Select a valid plan.");

  const durationDays = input.durationDays == null || Number(input.durationDays) <= 0
    ? Number(plan.duration_days ?? 30)
    : Math.floor(Number(input.durationDays));
  const expires = durationDays > 0 ? new Date(Date.now() + durationDays * 86400_000).toISOString() : null;
  const requestedName = input.name?.trim() || null;
  const { data: generatedName } = requestedName
    ? { data: requestedName }
    : await client.rpc("next_customer_profile_name");
  const profileName = String(generatedName || requestedName || "User001");
  const status = input.status === "PENDING_APPROVAL" || input.status === "SUSPENDED" ? input.status : "ACTIVE";

  const { data: tenant, error: tenantError } = await client
    .from("tenants")
    .insert({
      name: profileName,
      plan_id: plan.id,
      plan_expires_at: expires,
      status: status === "ACTIVE" ? "ACTIVE" : "SUSPENDED",
    })
    .select("id")
    .single();
  if (tenantError || !tenant) throw new Error("Could not create the workspace.");

  try {
    const { data: customer, error: customerError } = await client
      .from("customers")
      .insert({
        tenant_id: tenant.id,
        email,
        password_hash: await hashPassword(input.password),
        name: profileName,
        status,
        email_verified: true,
      })
      .select("id")
      .single();
    if (customerError || !customer) throw new Error(customerError?.message ?? "Could not create the account.");

    const { error: memberError } = await client.from("tenant_members").insert({
      tenant_id: tenant.id,
      customer_id: customer.id,
      role: "customer",
    });
    if (memberError) throw new Error(memberError.message);

    const { error: subscriptionError } = await client.from("subscriptions").insert({
      tenant_id: tenant.id,
      plan_id: plan.id,
      status: input.unlimited ? "MANUAL" : "ACTIVE",
      payment_status: "MANUAL",
      expires_at: expires,
      no_expiry: expires === null,
      granted_by: adminId,
      grant_reason: input.reason ?? "Admin-created customer",
      metadata: { admin_created: true, unlimited: Boolean(input.unlimited) },
    });
    if (subscriptionError) throw new Error(subscriptionError.message);

    if (input.unlimited) {
      const { error: overrideError } = await client.from("tenant_entitlement_overrides").upsert(
        {
          tenant_id: tenant.id,
          override_type: "UNLIMITED",
          max_connections: 20,
          max_active_campaigns: null,
          max_saved_groups: null,
          monthly_groups_found_limit: null,
          monthly_audience_found_limit: null,
          monthly_message_limit: null,
          monthly_dm_message_limit: null,
          max_categories: null,
          monthly_writable_check_limit: null,
          monthly_sendable_check_limit: null,
          analytics_level: "full",
          scheduling_enabled: true,
          session_health_level: "full",
          expires_at: expires,
          granted_by: adminId,
          grant_reason: input.reason ?? "Admin-created custom unlimited customer",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" },
      );
      if (overrideError) throw new Error(overrideError.message);
    }

    await client.from("notifications").insert({
      tenant_id: tenant.id,
      title: "Account created",
      body: `Your ${plan.name} plan is ready.`,
      kind: "SUCCESS",
      link: "/mini-app/billing",
    });
    await logAdmin({
      admin_user_id: adminId,
      action: "CUSTOMER_CREATED",
      resource: email,
      details: { plan: plan.code, status, durationDays, unlimited: Boolean(input.unlimited) },
    });
    return { ok: true, customerId: customer.id, tenantId: tenant.id };
  } catch (error) {
    await client.from("tenants").delete().eq("id", tenant.id);
    throw error;
  }
}
