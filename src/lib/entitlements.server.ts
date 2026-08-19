import { db } from "./db.server";
import type { Json } from "@/integrations/supabase/types";

export const HARD_SESSION_LIMIT = 20;
type SerializableRecord = Record<string, Json | undefined>;

export const PLAN_LIMIT_KEYS = [
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
] as const;

export type PlanLimitKey = (typeof PLAN_LIMIT_KEYS)[number];

export type UsageKey =
  | "groups_found"
  | "audience_found"
  | "promotion_messages"
  | "dm_messages"
  | "writable_checks"
  | "sendable_checks";

export const DEFAULT_PUBLIC_PLANS = [
  {
    code: "TEST",
    name: "TEST",
    description: "Product testing with restricted quotas.",
    price_usd: 0,
    duration_days: 30,
    sort_order: 1,
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
  },
  {
    code: "PLUS",
    name: "PLUS",
    description: "Small team growth plan.",
    price_usd: 20,
    duration_days: 30,
    sort_order: 2,
    max_connections: 5,
    max_active_campaigns: 5,
    max_saved_groups: 2000,
    monthly_groups_found_limit: 5000,
    monthly_audience_found_limit: 10000,
    monthly_message_limit: 20000,
    monthly_dm_message_limit: 5000,
    max_categories: 25,
    monthly_writable_check_limit: 5000,
    monthly_sendable_check_limit: 2500,
    analytics_level: "full",
    scheduling_enabled: true,
    session_health_level: "full",
  },
  {
    code: "PRO",
    name: "PRO",
    description: "Higher volume promotion operations.",
    price_usd: 30,
    duration_days: 30,
    sort_order: 3,
    max_connections: 10,
    max_active_campaigns: 15,
    max_saved_groups: 10000,
    monthly_groups_found_limit: 25000,
    monthly_audience_found_limit: 50000,
    monthly_message_limit: 100000,
    monthly_dm_message_limit: 25000,
    max_categories: 100,
    monthly_writable_check_limit: 25000,
    monthly_sendable_check_limit: 15000,
    analytics_level: "full",
    scheduling_enabled: true,
    session_health_level: "full",
  },
  {
    code: "ENTERPRISE",
    name: "ENTERPRISE",
    description: "Unlimited plan quotas with Telegram session cap.",
    price_usd: 50,
    duration_days: 30,
    sort_order: 4,
    max_connections: HARD_SESSION_LIMIT,
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
  },
] as const;

export function currentPeriodStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

function limitLabel(limit: number | null | undefined) {
  return limit == null ? "Unlimited" : Number(limit).toLocaleString();
}

function normalizeLimit(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid quota value.");
  return Math.floor(n);
}

function planLimit(plan: SerializableRecord | null, key: PlanLimitKey): number | null {
  if (!plan) return null;
  if (key === "max_saved_groups" && plan[key] == null && plan["max_groups"] != null) {
    return normalizeLimit(plan["max_groups"]);
  }
  if (key === "max_active_campaigns" && plan[key] == null && plan["max_campaigns"] != null) {
    return normalizeLimit(plan["max_campaigns"]);
  }
  if (key === "monthly_audience_found_limit" && plan[key] == null && plan["max_audience"] != null) {
    return normalizeLimit(plan["max_audience"]);
  }
  return normalizeLimit(plan[key]);
}

async function activeOverride(tenantId: string) {
  const { data } = await db()
    .from("tenant_entitlement_overrides")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at as string) < new Date()) return null;
  return data as SerializableRecord;
}

async function testPlan() {
  const { data } = await db().from("plans").select("*").eq("code", "TEST").maybeSingle();
  return (data ?? null) as SerializableRecord | null;
}

async function activePlanForTenant(tenantId: string) {
  const { data: tenant } = await db()
    .from("tenants")
    .select("*, plans(*)")
    .eq("id", tenantId)
    .maybeSingle();
  const rawPlan = Array.isArray(tenant?.plans) ? tenant?.plans[0] : tenant?.plans;
  const expired = Boolean(tenant?.plan_expires_at && new Date(tenant.plan_expires_at as string) < new Date());
  return {
    tenant: tenant as SerializableRecord | null,
    plan: expired ? await testPlan() : ((rawPlan ?? (await testPlan())) as SerializableRecord | null),
    expired,
  };
}

export async function ensureDefaultPlans() {
  const client = db();
  const { data: existing } = await client
    .from("plans")
    .select("code")
    .in("code", DEFAULT_PUBLIC_PLANS.map((plan) => plan.code));
  const existingCodes = new Set((existing ?? []).map((plan) => String(plan.code)));
  for (const plan of DEFAULT_PUBLIC_PLANS) {
    if (existingCodes.has(plan.code)) continue;
    await client
      .from("plans")
      .insert(
        {
          ...plan,
          is_public: true,
          is_custom: false,
          is_active: true,
          max_groups: plan.max_saved_groups,
          max_campaigns: plan.max_active_campaigns,
          max_audience: plan.monthly_audience_found_limit,
          updated_at: new Date().toISOString(),
        },
      );
  }
}

export async function getMonthlyUsage(tenantId: string) {
  const period = currentPeriodStart();
  const client = db();
  const { data: created, error } = await client
    .from("monthly_usage")
    .upsert({ tenant_id: tenantId, period_start: period }, { onConflict: "tenant_id,period_start" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return created as Record<string, number | string>;
}

export async function incrementMonthlyUsage(tenantId: string, increments: Partial<Record<UsageKey, number>>) {
  const payload = {
    p_tenant_id: tenantId,
    p_period_start: currentPeriodStart(),
    p_groups_found: Math.max(0, Math.floor(Number(increments.groups_found ?? 0))),
    p_audience_found: Math.max(0, Math.floor(Number(increments.audience_found ?? 0))),
    p_promotion_messages: Math.max(0, Math.floor(Number(increments.promotion_messages ?? 0))),
    p_dm_messages: Math.max(0, Math.floor(Number(increments.dm_messages ?? 0))),
    p_writable_checks: Math.max(0, Math.floor(Number(increments.writable_checks ?? 0))),
    p_sendable_checks: Math.max(0, Math.floor(Number(increments.sendable_checks ?? 0))),
  };
  if (
    !payload.p_groups_found &&
    !payload.p_audience_found &&
    !payload.p_promotion_messages &&
    !payload.p_dm_messages &&
    !payload.p_writable_checks &&
    !payload.p_sendable_checks
  ) {
    return getMonthlyUsage(tenantId);
  }
  const { data, error } = await db().rpc("increment_monthly_usage", payload);
  if (error) throw new Error(error.message);
  return data;
}

export async function tenantEntitlementSummary(tenantId: string) {
  const [{ tenant, plan, expired }, override, usage] = await Promise.all([
    activePlanForTenant(tenantId),
    activeOverride(tenantId),
    getMonthlyUsage(tenantId),
  ]);
  const limits = {} as Record<PlanLimitKey, number | null>;
  for (const key of PLAN_LIMIT_KEYS) {
    limits[key] = override && Object.prototype.hasOwnProperty.call(override, key)
      ? normalizeLimit(override[key])
      : planLimit(plan, key);
  }
  limits.max_connections = Math.min(limits.max_connections ?? HARD_SESSION_LIMIT, HARD_SESSION_LIMIT);
  return {
    tenant,
    plan,
    override,
    expired,
    limits,
    features: {
      analytics_level: String(override?.analytics_level ?? plan?.analytics_level ?? "basic"),
      scheduling_enabled: Boolean(override?.scheduling_enabled ?? plan?.scheduling_enabled ?? false),
      session_health_level: String(override?.session_health_level ?? plan?.session_health_level ?? "basic"),
    },
    usage,
  };
}

export async function tenantUsageDashboard(tenantId: string) {
  const client = db();
  const [entitlements, sessions, activeCampaigns, savedGroups, categories] = await Promise.all([
    tenantEntitlementSummary(tenantId),
    client
      .from("telegram_connections")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .neq("status", "DISCONNECTED"),
    client
      .from("campaigns")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["RUNNING", "SCHEDULED", "PENDING_APPROVAL", "PAUSED"]),
    client
      .from("discovered_groups")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .in("status", ["APPROVED", "JOINED"]),
    client.from("group_categories").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
  ]);
  const usage = entitlements.usage as Record<string, number | string>;
  return {
    ...entitlements,
    counts: {
      sessions: sessions.count ?? 0,
      active_campaigns: activeCampaigns.count ?? 0,
      saved_groups: savedGroups.count ?? 0,
      categories: categories.count ?? 0,
      groups_found: Number(usage.groups_found ?? 0),
      audience_found: Number(usage.audience_found ?? 0),
      promotion_messages: Number(usage.promotion_messages ?? 0),
      dm_messages: Number(usage.dm_messages ?? 0),
      writable_checks: Number(usage.writable_checks ?? 0),
      sendable_checks: Number(usage.sendable_checks ?? 0),
    },
  };
}

export async function assertEntitlement(
  tenantId: string,
  key: PlanLimitKey,
  current: number,
  adding = 1,
  message?: string,
) {
  const { limits, plan } = await tenantEntitlementSummary(tenantId);
  const limit = limits[key];
  if (key === "max_connections" && current + adding > HARD_SESSION_LIMIT) {
    throw new Error(`A tenant can connect up to ${HARD_SESSION_LIMIT} Telegram sessions.`);
  }
  if (limit != null && current + adding > limit) {
    const planName = String(plan?.name ?? plan?.code ?? "current");
    if (key === "max_connections") {
      throw new Error(message ?? `Your ${planName} plan allows ${limitLabel(limit)} linked session${limit === 1 ? "" : "s"}.`);
    }
    throw new Error(message ?? `Your ${planName} plan allows ${limitLabel(limit)} for ${key.replace(/_/g, " ")}.`);
  }
}

export async function assertUsageQuota(
  tenantId: string,
  usageKey: UsageKey,
  limitKey: PlanLimitKey,
  adding = 1,
  message?: string,
) {
  const summary = await tenantEntitlementSummary(tenantId);
  const limit = summary.limits[limitKey];
  if (limit == null) return;
  const current = Number((summary.usage as Record<string, unknown>)[usageKey] ?? 0);
  if (current + adding > limit) {
    throw new Error(message ?? `Monthly ${usageKey.replace(/_/g, " ")} limit reached.`);
  }
}

export function formatLimit(limit: number | null | undefined) {
  return limitLabel(limit);
}
