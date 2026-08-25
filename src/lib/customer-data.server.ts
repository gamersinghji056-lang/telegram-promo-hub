import { db, getSetting, logSystem, notify } from "./db.server";
import type { AuthContext } from "./customer-auth.server";
import { callBot, botToken } from "./telegram.server";
import { createHash, randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "./security.server";
import {
  addUserToDestinationViaUserSession,
  checkAddUsersDestinationViaUserSession,
  checkUserSession,
  completeUserSessionCode,
  completeUserSessionPassword,
  disconnectUserSession,
  discoverAudienceViaUserSession,
  folderLinkEligibilityViaUserSession,
  importGroupsFromFolderViaUserSession,
  createShareableFolderLinkViaUserSession,
  customEmojiPreviewViaUserSession,
  customEmojiPreviewsViaUserSession,
  joinGroupViaUserSession,
  listCustomEmojiCatalogViaUserSession,
  resolvePublicGroupViaUserSession,
  searchPublicGroupsViaUserSession,
  startUserSessionReconnect,
  startUserSessionLogin,
  testGroupSendableViaUserSession,
  verifyGroupWritableViaUserSession,
  revokeShareableFolderLinkViaUserSession,
} from "./telegram-user-session.server";
import {
  bestTenantSession,
  eligibleTenantSessions,
  sessionUsable,
} from "./telegram-session-health.server";
import {
  assertEntitlement,
  assertUsageQuota,
  ensureDefaultPlans,
  incrementMonthlyUsage,
  tenantUsageDashboard,
} from "./entitlements.server";
import {
  PLAN_RANK,
  PREMIUM_EMOJI_CODE,
  activeInvoice,
  createInvoice,
  invoiceByIdForTenant,
  officialPlans,
  premiumEmojiEntitlement,
  premiumEmojiSettings,
} from "./billing.server";
import { reconcileInvoicePayment } from "./tron-monitor.server";
import { normalizeMessageEntities } from "./message-entities";
const LINK_CODE_TTL_MS = 15 * 60_000;

export function hashConnectionLinkCode(code: string) {
  return createHash("sha256")
    .update(`telegram-connection:${code.trim().toUpperCase()}`)
    .digest("hex");
}

function newLinkCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

async function requireConnection(ctx: AuthContext, connectionId?: string | null) {
  if (!connectionId) throw new Error("Select a connected Telegram session.");
  const { data: connection } = await db()
    .from("telegram_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!connection) throw new Error("Telegram session not found.");
  if (!connection.encrypted_session) throw new Error("This Telegram session is not authorized.");
  if (["DISCONNECTED", "AUTH_CODE_SENT", "TWO_FACTOR_REQUIRED"].includes(String(connection.status))) {
    throw new Error("This Telegram session is not authorized.");
  }
  if (connection.cooldown_until && new Date(connection.cooldown_until as string) > new Date()) {
    throw new Error("Selected Telegram session is cooling down.");
  }
  return connection;
}

async function defaultHealthyConnection(ctx: AuthContext) {
  const connection = await bestTenantSession(ctx.tenantId);
  if (!connection) throw new Error("Connect a Telegram session first.");
  return connection;
}

async function clientConnectionUsed(tenantId: string, connectionId: string) {
  await db()
    .from("telegram_connections")
    .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", connectionId)
    .eq("tenant_id", tenantId);
}

function normalizePublicGroupInput(value: string) {
  const raw = value.trim();
  const match = raw.match(/(?:https?:\/\/)?t\.me\/([A-Za-z0-9_]+)/i);
  const handle = (match?.[1] ?? raw).replace(/^@/, "").trim();
  if (!/^[A-Za-z0-9_]{4,32}$/.test(handle)) {
    throw new Error("Enter a valid public Telegram group username or t.me link.");
  }
  return handle;
}

const PENDING_JOB_STATUSES = ["QUEUED", "PROCESSING", "HELD", "PAUSED", "COOLDOWN"];
const FAILED_JOB_STATUSES = [
  "FAILED",
  "SKIPPED",
  "EXCLUDED",
  "ENTITY_UNAVAILABLE",
  "NOT_WRITABLE",
  "CANCELLED",
];

type CampaignJobStats = {
  total_messages: number;
  sent_messages: number;
  pending_messages: number;
  failed_messages: number;
  groups_per_cycle?: number;
  completed_cycles?: number;
  current_cycle_attempted?: number;
  total_attempted?: number;
};

function emptyJobStats(): CampaignJobStats {
  return {
    total_messages: 0,
    sent_messages: 0,
    pending_messages: 0,
    failed_messages: 0,
    groups_per_cycle: 0,
    completed_cycles: 0,
    current_cycle_attempted: 0,
    total_attempted: 0,
  };
}

async function campaignJobStatsMap(
  client: ReturnType<typeof db>,
  tenantId: string,
  campaignIds: string[],
) {
  const map = new Map<string, CampaignJobStats>();
  if (!campaignIds.length) return map;
  const { data } = await client
    .from("campaign_job_stats")
    .select("campaign_id, total_messages, sent_messages, pending_messages, failed_messages, groups_per_cycle, completed_cycles, current_cycle_attempted, total_attempted")
    .eq("tenant_id", tenantId)
    .in("campaign_id", campaignIds);
  for (const row of data ?? []) {
    map.set(String(row.campaign_id), {
      total_messages: Number(row.total_messages ?? 0),
      sent_messages: Number(row.sent_messages ?? 0),
      pending_messages: Number(row.pending_messages ?? 0),
      failed_messages: Number(row.failed_messages ?? 0),
      groups_per_cycle: Number(row.groups_per_cycle ?? 0),
      completed_cycles: Number(row.completed_cycles ?? 0),
      current_cycle_attempted: Number(row.current_cycle_attempted ?? 0),
      total_attempted: Number(row.total_attempted ?? 0),
    });
  }
  return map;
}

function withCampaignJobStats<T extends Record<string, unknown>>(
  campaign: T,
  stats: CampaignJobStats | undefined,
) {
  const next = stats ?? emptyJobStats();
  return {
    ...campaign,
    job_stats: next,
    completed_count: next.sent_messages,
    failed_count: next.failed_messages,
    pending_count: next.pending_messages,
  };
}

function sumJobStats(rows: CampaignJobStats[]) {
  return rows.reduce(
    (total, row) => ({
      total_messages: total.total_messages + Number(row.total_messages ?? 0),
      sent_messages: total.sent_messages + Number(row.sent_messages ?? 0),
      pending_messages: total.pending_messages + Number(row.pending_messages ?? 0),
      failed_messages: total.failed_messages + Number(row.failed_messages ?? 0),
    }),
    emptyJobStats(),
  );
}

/* ---------------------------------- plan / usage --------------------------------- */

export async function tenantOverview(ctx: AuthContext) {
  const client = db();
  const { data: tenant } = await client
    .from("tenants")
    .select("*, plans(*)")
    .eq("id", ctx.tenantId)
    .maybeSingle();
  return tenant;
}

export async function dashboard(ctx: AuthContext) {
  const client = db();
  const t = ctx.tenantId;
  const count = async (table: string, filters: Record<string, unknown> = {}) => {
    let q = client.from(table).select("id", { count: "exact", head: true }).eq("tenant_id", t);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { count: c } = await q;
    return c ?? 0;
  };
  const countIn = async (table: string, column: string, values: string[]) => {
    const { count: c } = await client
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", t)
      .in(column, values);
    return c ?? 0;
  };

  const [
    connections,
    activeConnections,
    issueConnections,
    restrictedConnections,
    keywords,
    groupsFound,
    groupsPending,
    groupsApproved,
    groupsWritable,
    groupsSendable,
    groupsJoined,
    audienceTotal,
    audienceContacted,
    running,
    scheduled,
    completed,
    failed,
    dmCampaigns,
    groupCampaigns,
    unread,
  ] = await Promise.all([
    count("telegram_connections"),
    count("telegram_connections", { status: "CONNECTED" }),
    count("telegram_connections", { status: "ERROR" }),
    countIn("telegram_connections", "restriction_status", [
      "COOLDOWN",
      "RESTRICTED",
      "REQUIRES_ACTION",
    ]),
    count("keywords"),
    count("discovered_groups"),
    count("discovered_groups", { status: "FOUND" }),
    count("discovered_groups", { status: "APPROVED" }),
    count("discovered_groups", { can_send_messages: true, writable_status: "WRITABLE" }),
    count("discovered_groups", { sendable_status: "SENDABLE" }),
    count("discovered_groups", { status: "JOINED" }),
    count("audience_contacts"),
    count("audience_contacts", { status: "CONTACTED" }),
    count("campaigns", { status: "RUNNING" }),
    count("campaigns", { status: "SCHEDULED" }),
    count("campaigns", { status: "COMPLETED" }),
    count("campaigns", { status: "FAILED" }),
    count("campaigns", { type: "DM" }),
    count("campaigns", { type: "GROUP" }),
    client
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", t)
      .is("read_at", null)
      .then((r) => r.count ?? 0),
  ]);

  const tenant = await tenantOverview(ctx);
  const plan = (tenant as { plans?: Record<string, number | string> } | null)?.plans ?? null;
  const entitlement = await tenantUsageDashboard(ctx.tenantId);
  const { data: jobStatsRows } = await client
    .from("campaign_job_stats")
    .select("total_messages, sent_messages, pending_messages, failed_messages")
    .eq("tenant_id", t);
  const messageStats = sumJobStats((jobStatsRows ?? []) as CampaignJobStats[]);

  return {
    connections: {
      total: connections,
      active: activeConnections,
      issues: issueConnections,
      restricted: restrictedConnections,
    },
    keywords,
    groups: {
      found: groupsFound,
      pending: groupsPending,
      approved: groupsApproved,
      writable: groupsWritable,
      sendable: groupsSendable,
      joined: groupsJoined,
    },
    audience: {
      total: audienceTotal,
      contacted: audienceContacted,
      available: Math.max(audienceTotal - audienceContacted, 0),
    },
    campaigns: {
      running,
      scheduled,
      completed,
      failed,
      dm: dmCampaigns,
      group: groupCampaigns,
      messages: messageStats,
    },
    usage: {
      messagesUsed: entitlement.counts.promotion_messages,
      messageLimit: entitlement.limits.monthly_message_limit,
      dmMessagesUsed: entitlement.counts.dm_messages,
      dmMessageLimit: entitlement.limits.monthly_dm_message_limit,
      groupsFoundUsed: entitlement.counts.groups_found,
      groupsFoundLimit: entitlement.limits.monthly_groups_found_limit,
      audienceFoundUsed: entitlement.counts.audience_found,
      audienceFoundLimit: entitlement.limits.monthly_audience_found_limit,
      writableChecksUsed: entitlement.counts.writable_checks,
      writableChecksLimit: entitlement.limits.monthly_writable_check_limit,
      sendableChecksUsed: entitlement.counts.sendable_checks,
      sendableChecksLimit: entitlement.limits.monthly_sendable_check_limit,
      categoriesUsed: entitlement.counts.categories,
      categoriesLimit: entitlement.limits.max_categories,
      groupsUsed: entitlement.counts.saved_groups,
      groupsLimit: entitlement.limits.max_saved_groups,
      connectionsUsed: entitlement.counts.sessions,
      connectionsLimit: entitlement.limits.max_connections,
      activeCampaignsUsed: entitlement.counts.active_campaigns,
      activeCampaignsLimit: entitlement.limits.max_active_campaigns,
    },
    subscription: {
      planName: String(entitlement.plan?.["name"] ?? plan?.["name"] ?? "No plan"),
      price: Number(entitlement.plan?.["price_usd"] ?? plan?.["price_usd"] ?? 0),
      expiresAt: (tenant as { plan_expires_at?: string } | null)?.plan_expires_at ?? null,
      status: (tenant as { status?: string } | null)?.status ?? "ACTIVE",
      expired: entitlement.expired,
    },
    unreadNotifications: unread,
    account: { email: ctx.email, name: ctx.name },
  };
}

export async function accountProfile(ctx: AuthContext) {
  const { data } = await db()
    .from("customers")
    .select("id, email, name, status")
    .eq("id", ctx.customerId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!data) throw new Error("Account not found.");
  return {
    name: (data.name as string | null) || ctx.name || "User001",
    email: data.email as string,
    status: (data.status as string | null) ?? "ACTIVE",
  };
}

export async function updateAccountName(ctx: AuthContext, name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2) throw new Error("Enter a display name.");
  if (trimmed.length > 80) throw new Error("Display name is too long.");
  const { data, error } = await db()
    .from("customers")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", ctx.customerId)
    .eq("tenant_id", ctx.tenantId)
    .select("email, name, status")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not update display name.");
  return { name: data.name, email: data.email, status: data.status };
}

export async function changeAccountPassword(
  ctx: AuthContext,
  input: { currentPassword: string; newPassword: string },
) {
  if (!input.newPassword || input.newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  const client = db();
  const { data } = await client
    .from("customers")
    .select("password_hash")
    .eq("id", ctx.customerId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!data || !(await verifyPassword(input.currentPassword, data.password_hash as string))) {
    throw new Error("Current password is incorrect.");
  }
  const { error } = await client
    .from("customers")
    .update({ password_hash: await hashPassword(input.newPassword), updated_at: new Date().toISOString() })
    .eq("id", ctx.customerId)
    .eq("tenant_id", ctx.tenantId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* -------------------------------- connections ------------------------------------ */

export async function listConnections(ctx: AuthContext) {
  const client = db();
  const [{ data }, { data: preferences }] = await Promise.all([
    client
    .from("telegram_connections")
    .select(
      "id, tenant_id, label, account_name, username, telegram_id, telegram_user_id, phone_masked, status, health, health_score, health_updated_at, health_summary, telegram_premium, telegram_premium_checked_at, session_error_code, error_message, restriction_status, restriction_reason, last_active_at, last_used_at, last_sync_at, link_expires_at, cooldown_until, auth_step, encrypted_session, created_at, updated_at",
    )
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false }),
    client
      .from("customer_preferences")
      .select("premium_emoji_session_mode, preferred_premium_emoji_connection_id")
      .eq("tenant_id", ctx.tenantId)
      .eq("customer_id", ctx.customerId)
      .maybeSingle(),
  ]);
  const rows = data ?? [];
  return rows.map(({ encrypted_session, ...row }) => ({
      ...row,
      has_session: Boolean(encrypted_session),
      premiumEmojiSessionMode: preferences?.premium_emoji_session_mode ?? "AUTO",
      preferredPremiumEmojiConnectionId: preferences?.preferred_premium_emoji_connection_id ?? null,
    }));
}

export async function setPreferredPremiumEmojiSession(
  ctx: AuthContext,
  input: { mode: "AUTO" | "MANUAL"; connectionId?: string | null },
) {
  const mode = input.mode === "MANUAL" ? "MANUAL" : "AUTO";
  let connectionId: string | null = null;
  if (mode === "MANUAL") {
    const row = await requireConnection(ctx, input.connectionId);
    if (!sessionUsable(row as Record<string, unknown>)) {
      throw new Error("Choose a connected healthy Telegram session.");
    }
    if ((row as { telegram_premium?: boolean | null }).telegram_premium !== true) {
      throw new Error("Choose a Telegram Premium session.");
    }
    connectionId = String(row.id);
  }
  await db().from("customer_preferences").upsert(
    {
      customer_id: ctx.customerId,
      tenant_id: ctx.tenantId,
      premium_emoji_session_mode: mode,
      preferred_premium_emoji_connection_id: connectionId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "customer_id" },
  );
  return {
    premium_emoji_session_mode: mode,
    preferred_premium_emoji_connection_id: connectionId,
  };
}

export async function createConnection(ctx: AuthContext, label: string) {
  throw new Error("Use ADD SESSION with phone verification inside the Mini App.");
}

export async function checkConnection(ctx: AuthContext, connectionId: string) {
  return checkUserSession(ctx, connectionId);
}

export async function testSessionHealth(ctx: AuthContext, connectionId: string) {
  const connection = await requireConnection(ctx, connectionId);
  const diagnostics: {
    name: string;
    status: "PASS" | "WARN" | "FAIL" | "SKIPPED";
    message: string;
    details?: Record<string, unknown>;
  }[] = [];
  try {
    const checked = await checkUserSession(ctx, String(connection.id));
    const connected = checked.ok && (checked.connection as { status?: string })?.status === "CONNECTED";
    diagnostics.push({
      name: "Authorization",
      status: connected ? "PASS" : "FAIL",
      message: connected ? "Authorization is valid." : "Authorization needs attention.",
    });
  } catch (error) {
    diagnostics.push({
      name: "Authorization",
      status: "FAIL",
      message: error instanceof Error ? error.message : "Authorization check failed.",
    });
  }
  diagnostics.push({
    name: "Cooldown",
    status:
      connection.cooldown_until && new Date(connection.cooldown_until as string) > new Date()
        ? "WARN"
        : "PASS",
    message:
      connection.cooldown_until && new Date(connection.cooldown_until as string) > new Date()
        ? "Telegram rate limit is active."
        : "No active cooldown.",
  });
  const { data: groups } = await db()
    .from("discovered_groups")
    .select("id, title, username, telegram_group_id, access_hash, entity_type, status")
    .eq("tenant_id", ctx.tenantId)
    .in("status", ["APPROVED", "JOINED"])
    .order("updated_at", { ascending: false })
    .limit(5);
  if (groups?.length) {
    const checks = await runAutoGroupChecks(ctx, {
      groupIds: groups.map((group) => String(group.id)),
      mode: "WRITABLE",
      limit: 5,
    });
    diagnostics.push({
      name: "Entity resolution",
      status: checks.checked > 0 && checks.inaccessible === checks.checked ? "FAIL" : "PASS",
      message: `Resolved ${checks.checked - checks.inaccessible}/${checks.checked} eligible groups.`,
      details: checks,
    });
    const joinedSendable = (groups ?? []).find((group) => group.status === "JOINED" && group.username);
    if (joinedSendable) {
      const send = await testGroupSendableViaUserSession(ctx.tenantId, String(connection.id), {
        username: joinedSendable.username as string | null,
        telegram_group_id: joinedSendable.telegram_group_id as number | null,
        access_hash: joinedSendable.access_hash as string | null,
        entity_type: joinedSendable.entity_type as string | null,
      });
      diagnostics.push({
        name: "Safe send/delete",
        status: send.sendableStatus === "SENDABLE" ? "PASS" : "WARN",
        message: send.reason ?? String(send.sendableStatus),
        details: send as Record<string, unknown>,
      });
    } else {
      diagnostics.push({
        name: "Safe send/delete",
        status: "SKIPPED",
        message: "No joined eligible test group is configured.",
      });
    }
  } else {
    diagnostics.push({
      name: "Entity resolution",
      status: "SKIPPED",
      message: "No approved groups are available for diagnostics.",
    });
  }
  diagnostics.push({
    name: "DM diagnostic",
    status: "SKIPPED",
    message: "DM diagnostic not configured/skipped.",
  });
  const { data: refreshed } = await db()
    .from("telegram_connections")
    .select("health_score, health_updated_at, health_summary")
    .eq("id", connection.id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  return {
    connection_id: connection.id,
    health_score: refreshed?.health_score ?? connection.health_score ?? 75,
    health_summary: refreshed?.health_summary ?? "Health test completed.",
    health_updated_at: refreshed?.health_updated_at ?? new Date().toISOString(),
    diagnostics,
  };
}

export async function startConnectionLogin(
  ctx: AuthContext,
  input: { label: string; phone: string },
) {
  return startUserSessionLogin(ctx, input);
}

export async function reconnectConnection(ctx: AuthContext, connectionId: string) {
  return startUserSessionReconnect(ctx, { connectionId });
}

export async function verifyConnectionCode(
  ctx: AuthContext,
  input: { connectionId: string; code: string },
) {
  return completeUserSessionCode(ctx, input);
}

export async function verifyConnectionPassword(
  ctx: AuthContext,
  input: { connectionId: string; password: string },
) {
  return completeUserSessionPassword(ctx, input);
}

export async function disconnectConnection(ctx: AuthContext, connectionId: string) {
  await disconnectUserSession(ctx, connectionId);
  await logSystem({
    tenant_id: ctx.tenantId,
    customer_id: ctx.customerId,
    action: "CONNECTION_DISCONNECTED",
  });
}

export async function deleteConnection(ctx: AuthContext, connectionId: string) {
  await db()
    .from("telegram_connections")
    .delete()
    .eq("id", connectionId)
    .eq("tenant_id", ctx.tenantId);
}

export async function linkConnectionFromBot(input: {
  code: string;
  telegramUserId: number;
  username?: string | null;
  firstName?: string | null;
}) {
  const client = db();
  const codeHash = hashConnectionLinkCode(input.code);
  const { data: connection } = await client
    .from("telegram_connections")
    .select("*")
    .eq("link_code_hash", codeHash)
    .gt("link_expires_at", new Date().toISOString())
    .maybeSingle();
  if (!connection) return { ok: false as const, error: "This link code is invalid or expired." };

  const { data: existing } = await client
    .from("telegram_connections")
    .select("id, tenant_id")
    .eq("telegram_id", input.telegramUserId)
    .eq("status", "CONNECTED")
    .neq("id", connection.id)
    .maybeSingle();
  if (existing) return { ok: false as const, error: "This Telegram account is already connected." };

  const { error } = await client
    .from("telegram_connections")
    .update({
      account_name: input.firstName ?? input.username ?? "Telegram account",
      username: input.username ?? null,
      telegram_id: input.telegramUserId,
      status: "CONNECTED",
      restriction_status: "NONE",
      error_message: null,
      link_code_hash: null,
      link_expires_at: null,
      last_active_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);
  if (error) return { ok: false as const, error: error.message };

  await logSystem({
    tenant_id: connection.tenant_id as string,
    action: "CONNECTION_LINKED",
    resource: input.username ? `@${input.username}` : String(input.telegramUserId),
  });
  return { ok: true as const };
}

/* ---------------------------------- keywords -------------------------------------- */

export async function listKeywords(ctx: AuthContext) {
  const { data } = await db()
    .from("keywords")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function addKeyword(ctx: AuthContext, keyword: string) {
  const value = keyword.trim().toLowerCase();
  if (!value) throw new Error("Keyword cannot be empty.");
  await db()
    .from("keywords")
    .upsert(
      { tenant_id: ctx.tenantId, keyword: value },
      { onConflict: "tenant_id,keyword", ignoreDuplicates: true },
    );
  return listKeywords(ctx);
}

export async function removeKeyword(ctx: AuthContext, id: string) {
  await db().from("keywords").delete().eq("id", id).eq("tenant_id", ctx.tenantId);
  return listKeywords(ctx);
}

/* ---------------------------------- groups ---------------------------------------- */

export async function discoveryStatus() {
  const s = await getSetting<{ provider_url?: string; provider_key?: string }>("discovery");
  return { configured: !!s.provider_url };
}

/**
 * Group discovery uses the selected authorized Telegram user session. If a provider is
 * configured, provider results are merged with Telegram contacts/public search results.
 */
export async function discoverGroups(ctx: AuthContext, connectionId: string, keywords: string[]) {
  const connection = await requireConnection(ctx, connectionId);
  const safeKeywords = [...new Set(keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))];
  if (!safeKeywords.length) throw new Error("Add at least one keyword before searching.");
  const result = await discoverGroupsForTenant(ctx.tenantId, connection.id as string, safeKeywords);
  await clientConnectionUsed(ctx.tenantId, connection.id as string);
  await logSystem({
    tenant_id: ctx.tenantId,
    action: "GROUP_DISCOVERY",
    details: { keywords: safeKeywords, found: result.results.length, added: result.added },
  });
  return result;
}

function discoveryTerms(keywords: string[], batch = 0) {
  const suffixes = ["", " group", " chat", " community", " official", " p2p", " trading"];
  const offset = batch % suffixes.length;
  return keywords.flatMap((keyword) => {
    const ordered = suffixes.slice(offset).concat(suffixes.slice(0, offset));
    return ordered.slice(0, 3).map((suffix) => `${keyword}${suffix}`.trim());
  });
}

async function discoverGroupsForTenant(tenantId: string, connectionId: string, safeKeywords: string[]) {
  await assertUsageQuota(
    tenantId,
    "groups_found",
    "monthly_groups_found_limit",
    Math.max(1, safeKeywords.length),
    "Monthly group discovery limit reached.",
  );
  const s = await getSetting<{ provider_url?: string; provider_key?: string }>("discovery");
  let providerRows: {
    title: string;
    username: string;
    member_count?: number | null;
    keywords?: string[];
  }[] = [];
  if (s.provider_url) {
    const res = await fetch(s.provider_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(s.provider_key ? { Authorization: `Bearer ${s.provider_key}` } : {}),
      },
      body: JSON.stringify({ keywords: safeKeywords }),
    });
    if (!res.ok) throw new Error(`Discovery provider failed [${res.status}]: ${await res.text()}`);
    const payload = (await res.json()) as {
      groups?: { title: string; username: string; member_count?: number; keywords?: string[] }[];
    };
    providerRows = payload.groups ?? [];
  }

  const sessionRows = await searchPublicGroupsViaUserSession(
    tenantId,
    connectionId,
    safeKeywords,
  );
  const merged = new Map<
    string,
    {
      title: string;
      username: string;
      member_count?: number | null;
      keywords?: string[];
      telegram_group_id?: number | null;
      accessHash?: string | null;
      entityType?: string | null;
      canSendMessages?: boolean | null;
    }
  >();
  for (const g of providerRows) {
    const username = g.username.replace(/^@/, "");
    if (username) merged.set(username.toLowerCase(), { ...g, username });
  }
  for (const g of sessionRows) {
    const existing = merged.get(g.username.toLowerCase());
    merged.set(g.username.toLowerCase(), {
      title: existing?.title ?? g.title,
      username: g.username,
      member_count: existing?.member_count ?? g.memberCount,
      keywords: [...new Set([...(existing?.keywords ?? []), ...g.matchedKeywords])],
      telegram_group_id: g.telegramGroupId,
      accessHash: g.accessHash,
      entityType: g.entityType,
      canSendMessages: g.canSendMessages,
    });
  }

  const rows = [...merged.values()].map((g) => ({
    tenant_id: tenantId,
    title: g.title,
    username: g.username.replace(/^@/, ""),
    member_count: g.member_count ?? null,
    matched_keywords: [...new Set(g.keywords ?? safeKeywords)],
    status: "FOUND",
    connection_id: connectionId,
    telegram_group_id: g.telegram_group_id ?? null,
    access_hash: g.accessHash ?? null,
    entity_type: g.entityType ?? null,
    can_send_messages: g.canSendMessages ?? null,
    writable_status: g.canSendMessages === false ? "NOT_WRITABLE" : "UNKNOWN",
    last_resolved_connection_id: connectionId,
    discovery_source: "AUTO",
    last_seen_at: new Date().toISOString(),
  }));
  let added = 0;
  let duplicates = 0;
  await assertUsageQuota(
    tenantId,
    "groups_found",
    "monthly_groups_found_limit",
    rows.length,
    "Monthly group discovery limit reached.",
  );
  if (rows.length) {
    const client = db();
    for (const row of rows) {
      const { data: existing } = await client
        .from("discovered_groups")
        .select("id, matched_keywords, status, discovery_source")
        .eq("tenant_id", tenantId)
        .eq("username", row.username)
        .maybeSingle();
      if (existing) {
        duplicates += 1;
        await client
          .from("discovered_groups")
          .update({
            title: row.title,
            member_count: row.member_count,
            telegram_group_id: row.telegram_group_id,
            access_hash: row.access_hash,
            entity_type: row.entity_type,
            can_send_messages: row.can_send_messages,
            writable_status: row.writable_status,
            last_resolved_connection_id: connectionId,
            last_seen_at: row.last_seen_at,
            matched_keywords: [
              ...new Set([...(existing.matched_keywords ?? []), ...row.matched_keywords]),
            ],
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("tenant_id", tenantId);
      } else {
        await client.from("discovered_groups").insert(row);
        added += 1;
      }
    }
  }
  if (added) await incrementMonthlyUsage(tenantId, { groups_found: added });
  return { configured: !!s.provider_url, added, duplicates, results: rows };
}

export async function groupDiscoveryState(ctx: AuthContext) {
  const { data } = await db()
    .from("group_discovery_states")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  return (
    data ?? {
      tenant_id: ctx.tenantId,
      status: "IDLE",
      keywords: [],
      total_found: 0,
      new_groups_found: 0,
      duplicates_found: 0,
      current_keyword: null,
      errors: [],
      last_search_at: null,
      next_search_at: null,
      last_error: null,
      batches_completed: 0,
    }
  );
}

function selectedSavedKeywords(saved: string[], selected?: string[]) {
  const allowed = new Set(saved.map((k) => k.toLowerCase()));
  const requested = selected?.map((k) => k.trim().toLowerCase()).filter((k) => allowed.has(k)) ?? [];
  return [...new Set(requested.length ? requested : saved)];
}

export async function startGroupDiscovery(ctx: AuthContext, connectionId: string, selected?: string[]) {
  const connection = await requireConnection(ctx, connectionId);
  const keywords = selectedSavedKeywords(
    (await listKeywords(ctx)).map((k) => String(k.keyword)),
    selected,
  );
  if (!keywords.length) throw new Error("Add at least one keyword before starting discovery.");
  await db().from("group_discovery_states").upsert(
    {
      tenant_id: ctx.tenantId,
      connection_id: connection.id,
      status: "RUNNING",
      keywords,
      selected_keywords: keywords,
      next_search_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );
  return groupDiscoveryState(ctx);
}

export async function pauseGroupDiscovery(ctx: AuthContext) {
  await db()
    .from("group_discovery_states")
    .upsert(
      { tenant_id: ctx.tenantId, status: "PAUSED", updated_at: new Date().toISOString() },
      { onConflict: "tenant_id" },
    );
  return groupDiscoveryState(ctx);
}

export async function searchGroupDiscoveryNow(ctx: AuthContext, connectionId?: string | null, selected?: string[]) {
  const existing = await groupDiscoveryState(ctx);
  const selectedConnection = connectionId || existing.connection_id;
  const connection = await requireConnection(ctx, selectedConnection);
  const keywords = selectedSavedKeywords(
    (await listKeywords(ctx)).map((k) => String(k.keyword)),
    selected ?? existing.selected_keywords ?? existing.keywords,
  );
  if (!keywords.length) throw new Error("Add at least one keyword before searching.");
  const batch = Number(existing.batches_completed ?? 0);
  const terms = discoveryTerms(keywords, batch);
  const result = await discoverGroupsForTenant(ctx.tenantId, connection.id as string, terms);
  const nextSearch = new Date(Date.now() + 15 * 60_000).toISOString();
  await db().from("group_discovery_states").upsert(
    {
      tenant_id: ctx.tenantId,
      connection_id: connection.id,
      status: existing.status === "RUNNING" ? "RUNNING" : "IDLE",
      keywords,
      selected_keywords: keywords,
      total_found: (existing.total_found ?? 0) + result.added,
      new_groups_found: result.added,
      duplicates_found: result.duplicates,
      current_keyword: terms[0] ?? null,
      last_search_at: new Date().toISOString(),
      next_search_at: existing.status === "RUNNING" ? nextSearch : null,
      last_error: null,
      batches_completed: Number(existing.batches_completed ?? 0) + 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );
  await clientConnectionUsed(ctx.tenantId, connection.id as string);
  return { ...result, state: await groupDiscoveryState(ctx) };
}

export async function processGroupDiscoveryJobs(limit = 5) {
  const { data: states } = await db()
    .from("group_discovery_states")
    .select("*")
    .eq("status", "RUNNING")
    .lte("next_search_at", new Date().toISOString())
    .limit(Math.max(1, Math.min(limit, 20)));
  let processed = 0;
  for (const state of states ?? []) {
    try {
      const keywords = (state.selected_keywords ?? state.keywords ?? []).map(String).filter(Boolean);
      if (!state.connection_id || !keywords.length) throw new Error("Discovery needs keywords and a healthy session.");
      const batch = Number(state.batches_completed ?? 0);
      const cursor = keywords.length ? batch % keywords.length : 0;
      const keyword = keywords[cursor];
      const terms = discoveryTerms([keyword], batch);
      console.info("DISCOVERY_BATCH_START", {
        tenantId: state.tenant_id,
        connectionId: state.connection_id,
        keyword,
        batch,
      });
      const result = await discoverGroupsForTenant(
        state.tenant_id as string,
        state.connection_id as string,
        terms,
      );
      console.info("DISCOVERY_BATCH_COMPLETE", {
        tenantId: state.tenant_id,
        connectionId: state.connection_id,
        keyword,
        added: result.added,
        duplicates: result.duplicates,
      });
      await db()
        .from("group_discovery_states")
        .update({
          total_found: Number(state.total_found ?? 0) + result.added,
          new_groups_found: result.added,
          duplicates_found: result.duplicates,
          current_keyword: keyword,
          last_search_at: new Date().toISOString(),
          next_search_at: new Date(Date.now() + 15 * 60_000).toISOString(),
          batches_completed: Number(state.batches_completed ?? 0) + 1,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", state.tenant_id);
      processed += 1;
    } catch (error) {
      await db()
        .from("group_discovery_states")
        .update({
          last_error: error instanceof Error ? error.message : "Discovery failed.",
          errors: [
            {
              time: new Date().toISOString(),
              message: error instanceof Error ? error.message : "Discovery failed.",
            },
          ],
          next_search_at: new Date(Date.now() + 15 * 60_000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", state.tenant_id);
    }
  }
  return { processed };
}

/** Resolves a public group by @username through the selected authorized user session. */
export async function addGroupByUsername(
  ctx: AuthContext,
  connectionId: string,
  username: string,
  keywords: string[],
) {
  const connection = await requireConnection(ctx, connectionId);
  const handle = normalizePublicGroupInput(username);
  const group = await resolvePublicGroupViaUserSession(
    ctx.tenantId,
    connection.id as string,
    handle,
  );
  if (group.canSendMessages === false) {
    throw new Error("This group/channel is not writable by the selected default Telegram session.");
  }

  const { data, error } = await db()
    .from("discovered_groups")
    .upsert(
      {
        tenant_id: ctx.tenantId,
        title: group.title,
        username: group.username,
        telegram_group_id: group.telegramGroupId,
        access_hash: group.accessHash,
        entity_type: group.entityType,
        can_send_messages: group.canSendMessages,
        writable_status: group.canSendMessages ? "WRITABLE" : "NOT_WRITABLE",
        last_resolved_connection_id: connection.id,
        member_count: group.memberCount,
        matched_keywords: keywords,
        status: "FOUND",
        connection_id: connection.id,
      },
      { onConflict: "tenant_id,username" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await clientConnectionUsed(ctx.tenantId, connection.id as string);
  await logSystem({ tenant_id: ctx.tenantId, action: "GROUP_FOUND", resource: group.username });
  return data;
}

export async function addApprovedGroupByUsername(
  ctx: AuthContext,
  username: string,
) {
  const connection = await defaultHealthyConnection(ctx);
  const handle = normalizePublicGroupInput(username);
  const group = await resolvePublicGroupViaUserSession(
    ctx.tenantId,
    connection.id as string,
    handle,
  );
  const { data, error } = await db()
    .from("discovered_groups")
    .upsert(
      {
        tenant_id: ctx.tenantId,
        title: group.title,
        username: group.username,
        telegram_group_id: group.telegramGroupId,
        access_hash: group.accessHash,
        entity_type: group.entityType,
        can_send_messages: group.canSendMessages,
        writable_status: group.canSendMessages === false ? "NOT_WRITABLE" : "WRITABLE",
        last_resolved_connection_id: connection.id,
        member_count: group.memberCount,
        matched_keywords: [],
        status: "APPROVED",
        approved_at: new Date().toISOString(),
        connection_id: connection.id,
        discovery_source: "MANUAL",
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,username" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await clientConnectionUsed(ctx.tenantId, connection.id as string);
  return data;
}

export async function importApprovedGroups(
  ctx: AuthContext,
  folderLink: string,
) {
  const connection = await defaultHealthyConnection(ctx);
  const groups = await importGroupsFromFolderViaUserSession(
    ctx.tenantId,
    connection.id as string,
    folderLink,
  );
  const stats = {
    totalGroups: groups.length,
    imported: 0,
    duplicates: 0,
    inaccessible: 0,
    notWritable: 0,
    alreadySaved: 0,
    failed: 0,
    auditId: null as string | null,
    details: [] as Record<string, unknown>[],
  };
  const client = db();
  for (const group of groups) {
    try {
      if (!group.username) {
        stats.inaccessible += 1;
        stats.details.push({
          title: group.title,
          status: group.status ?? "INACCESSIBLE",
          reason: group.reason ?? "Folder entry is not a usable public group.",
        });
        continue;
      }
      if (!group.canSendMessages) {
        stats.notWritable += 1;
        stats.details.push({
          title: group.title,
          username: group.username,
          status: "NOT_WRITABLE",
          reason: group.reason ?? "Selected session cannot post messages to this folder entry.",
        });
        continue;
      }
      const { data: existing } = await client
        .from("discovered_groups")
        .select("id, status")
        .eq("tenant_id", ctx.tenantId)
        .eq("username", group.username)
        .maybeSingle();
      if (existing) {
        if (["APPROVED", "JOINED"].includes(String(existing.status))) stats.alreadySaved += 1;
        else stats.duplicates += 1;
        if (!["APPROVED", "JOINED"].includes(String(existing.status))) {
          await client
            .from("discovered_groups")
            .update({
              status: "APPROVED",
              approved_at: new Date().toISOString(),
              access_hash: group.accessHash,
              entity_type: group.entityType,
              can_send_messages: group.canSendMessages,
              writable_status: group.writableStatus,
              last_resolved_connection_id: connection.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
            .eq("tenant_id", ctx.tenantId);
        }
        stats.details.push({
          title: group.title,
          username: group.username,
          status: "DUPLICATE",
          reason: "Group already exists for this tenant.",
        });
        continue;
      }
      await client.from("discovered_groups").insert({
        tenant_id: ctx.tenantId,
        title: group.title,
        username: group.username,
        telegram_group_id: group.telegramGroupId,
        access_hash: group.accessHash,
        entity_type: group.entityType,
        can_send_messages: group.canSendMessages,
        writable_status: group.writableStatus,
        last_resolved_connection_id: connection.id,
        member_count: group.memberCount,
        matched_keywords: [],
        status: "APPROVED",
        approved_at: new Date().toISOString(),
        connection_id: connection.id,
        discovery_source: "IMPORT",
        last_seen_at: new Date().toISOString(),
      });
      stats.imported += 1;
      stats.details.push({
        title: group.title,
        username: group.username,
        status: "IMPORTED",
      });
    } catch (error) {
      stats.failed += 1;
      stats.details.push({
        title: group.title,
        username: group.username,
        status: "FAILED",
        reason: error instanceof Error ? error.message : "Import failed.",
      });
    }
  }
  const { data: audit } = await client
    .from("group_import_audits")
    .insert({
      tenant_id: ctx.tenantId,
      connection_id: connection.id,
      folder_link: folderLink,
      total_groups: stats.totalGroups,
      duplicates: stats.duplicates,
      inaccessible: stats.inaccessible,
      not_writable: stats.notWritable,
      already_saved: stats.alreadySaved,
      imported: stats.imported,
      failed: stats.failed,
      details: stats.details,
    })
    .select("id")
    .single();
  stats.auditId = (audit?.id as string | undefined) ?? null;
  await clientConnectionUsed(ctx.tenantId, connection.id as string);
  await notify(
    ctx.tenantId,
    "Import completed",
    `Imported ${stats.imported} usable group(s). Skipped ${stats.notWritable + stats.alreadySaved + stats.duplicates + stats.failed}.`,
    "INFO",
    "/mini-app/groups-approved",
  );
  return stats;
}

export async function listGroups(ctx: AuthContext, status?: string) {
  let q = db().from("discovered_groups").select("*").eq("tenant_id", ctx.tenantId);
  if (status === "APPROVED_ACTIVE") q = q.in("status", ["APPROVED", "JOINED"]);
  else if (status === "AUTO_PENDING")
    q = q.eq("discovery_source", "AUTO").eq("status", "FOUND");
  else if (status && status !== "ALL") q = q.eq("status", status);
  const { data } = await q.order("discovered_at", { ascending: false });
  const rows = data ?? [];
  if (status === "APPROVED_ACTIVE") return Object.assign(rows, { totalApproved: rows.length });
  return rows;
}

export async function approvedGroupFolderLinks(ctx: AuthContext) {
  const { data } = await untypedDb()
    .from("telegram_folder_links")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("customer_id", ctx.customerId)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

const CHATLIST_LIMIT_MESSAGE = "Telegram shared-folder limit reached for this account.";
const EMPTY_EXPORT_MESSAGE = "No selected approved groups are exportable from this Telegram account.";

async function approvedFolderGroups(ctx: AuthContext, ids?: string[]) {
  let query = db()
    .from("discovered_groups")
    .select("id, title, username, member_count, telegram_group_id, access_hash, entity_type, status")
    .eq("tenant_id", ctx.tenantId)
    .in("status", ["APPROVED", "JOINED"]);
  if (ids?.length) query = query.in("id", ids);
  const { data, error } = await query.order("title", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

function reconnectRequired(row: Record<string, unknown>) {
  return !sessionUsable(row) ||
    String(row.health ?? "") === "RECONNECT_REQUIRED" ||
    String(row.session_error_code ?? "") === "AUTH_KEY_UNREGISTERED";
}

export async function approvedGroupFolderEligibility(ctx: AuthContext, connectionId?: string | null) {
  const groups = await approvedFolderGroups(ctx);
  if (!connectionId) throw new Error("Select a connected Telegram session.");
  const { data: connection } = await db()
    .from("telegram_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!connection) throw new Error("Telegram session not found.");
  if (reconnectRequired(connection as Record<string, unknown>)) {
    return {
      connectionId: String(connection.id),
      folderExportStatus: "RECONNECT_REQUIRED",
      folderExportMessage: "Reconnect required",
      eligibleCount: 0,
      groups: groups.map((group) => ({
        groupId: group.id,
        exportable: false,
        reason: "Reconnect required",
      })),
    };
  }
  try {
    const eligibility = await folderLinkEligibilityViaUserSession(ctx.tenantId, String(connection.id), groups.map((group) => ({
      id: String(group.id),
      username: group.username as string | null,
      telegram_group_id: group.telegram_group_id as number | null,
      access_hash: group.access_hash as string | null,
      entity_type: group.entity_type as string | null,
    })));
    const eligibleCount = eligibility.filter((row) => row.exportable).length;
    return {
      connectionId: String(connection.id),
      folderExportStatus: eligibleCount ? "READY" : "NO_ELIGIBLE_GROUPS",
      folderExportMessage: eligibleCount ? null : EMPTY_EXPORT_MESSAGE,
      eligibleCount,
      groups: eligibility,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("CHATLISTS_TOO_MUCH")) {
      return {
        connectionId: String(connection.id),
        folderExportStatus: "LIMIT_REACHED",
        folderExportMessage: CHATLIST_LIMIT_MESSAGE,
        eligibleCount: 0,
        groups: groups.map((group) => ({
          groupId: group.id,
          exportable: false,
          reason: "Not exportable by Telegram",
        })),
      };
    }
    throw error;
  }
}

export async function createApprovedGroupFolderLink(
  ctx: AuthContext,
  input: string[] | { connectionId?: string | null; groupIds: string[] },
) {
  const groupIds = Array.isArray(input) ? input : input.groupIds;
  const ids = [...new Set(groupIds)].filter(Boolean);
  if (!ids.length) throw new Error("Select at least one approved group.");
  const client = db();
  const connectionId = Array.isArray(input) ? null : input.connectionId;
  const connection = connectionId ? await requireConnection(ctx, connectionId) : await defaultHealthyConnection(ctx);
  if (!sessionUsable(connection as Record<string, unknown>)) throw new Error("Reconnect required");
  const rows = await approvedFolderGroups(ctx, ids);
  if (rows.length !== ids.length) throw new Error("Only your own approved groups can be exported.");
  const eligibility = await folderLinkEligibilityViaUserSession(ctx.tenantId, String(connection.id), rows.map((group) => ({
    id: String(group.id),
    username: group.username as string | null,
    telegram_group_id: group.telegram_group_id as number | null,
    access_hash: group.access_hash as string | null,
    entity_type: group.entity_type as string | null,
  })));
  const exportableIds = new Set(eligibility.filter((row) => row.exportable).map((row) => row.groupId));
  const exportRows = rows.filter((group) => exportableIds.has(String(group.id)));
  if (!exportRows.length) throw new Error(EMPTY_EXPORT_MESSAGE);
  if (exportRows.length !== rows.length) throw new Error(EMPTY_EXPORT_MESSAGE);
  const title = "WPAY Groups";
  const exportGroups = exportRows.map((group) => ({
    username: group.username as string | null,
    telegram_group_id: group.telegram_group_id as number | null,
    access_hash: group.access_hash as string | null,
    entity_type: group.entity_type as string | null,
  }));
  let result: Awaited<ReturnType<typeof createShareableFolderLinkViaUserSession>>;
  try {
    result = await createShareableFolderLinkViaUserSession(ctx.tenantId, String(connection.id), {
      title,
      groups: exportGroups,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("CHATLISTS_TOO_MUCH")) throw new Error(CHATLIST_LIMIT_MESSAGE);
    if (message.includes("FILTER_INCLUDE_EMPTY")) throw new Error(EMPTY_EXPORT_MESSAGE);
    throw error;
  }
  const includedGroups = rows.map((group) => ({
    id: group.id,
    title: group.title,
    username: group.username,
    member_count: group.member_count,
    status: group.status,
  }));
  const { data: link, error: insertError } = await untypedDb()
    .from("telegram_folder_links")
    .insert({
      tenant_id: ctx.tenantId,
      customer_id: ctx.customerId,
      connection_id: connection.id,
      title: result.title || title,
      url: result.url,
      slug: result.slug,
      filter_id: result.filterId,
      selected_group_ids: ids,
      included_groups: includedGroups,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (insertError || !link) throw new Error(insertError?.message ?? "Could not save Telegram folder link.");
  await clientConnectionUsed(ctx.tenantId, connection.id as string);
  await logSystem({
    tenant_id: ctx.tenantId,
    customer_id: ctx.customerId,
    action: "TELEGRAM_FOLDER_LINK_CREATED",
    resource: result.url,
    details: { group_count: rows.length, connection_id: connection.id },
  });
  return link;
}

export async function revokeApprovedGroupFolderLink(ctx: AuthContext, linkId: string) {
  const client = untypedDb();
  const { data: link } = await client
    .from("telegram_folder_links")
    .select("*")
    .eq("id", linkId)
    .eq("tenant_id", ctx.tenantId)
    .eq("customer_id", ctx.customerId)
    .is("revoked_at", null)
    .maybeSingle();
  if (!link) throw new Error("Folder link not found.");
  await revokeShareableFolderLinkViaUserSession(ctx.tenantId, String(link.connection_id), {
    filterId: Number(link.filter_id),
    slug: String(link.slug ?? ""),
  });
  const { data, error } = await client
    .from("telegram_folder_links")
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", linkId)
    .eq("tenant_id", ctx.tenantId)
    .eq("customer_id", ctx.customerId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logSystem({
    tenant_id: ctx.tenantId,
    customer_id: ctx.customerId,
    action: "TELEGRAM_FOLDER_LINK_REVOKED",
    resource: String(link.url ?? linkId),
  });
  return data;
}

export async function groupDetail(ctx: AuthContext, groupId: string) {
  const client = db();
  const { data: group } = await client
    .from("discovered_groups")
    .select("*, telegram_connections(label, username, status)")
    .eq("id", groupId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!group) throw new Error("Group not found.");
  const { data: campaigns } = await client
    .from("campaign_groups")
    .select("*, campaigns(name, type, status, created_at)")
    .eq("group_id", groupId)
    .eq("tenant_id", ctx.tenantId)
    .order("sent_at", { ascending: false })
    .limit(30);
  return { group, history: campaigns ?? [] };
}

export async function rejectGroup(ctx: AuthContext, groupId: string) {
  await db()
    .from("discovered_groups")
    .update({ status: "REJECTED" })
    .eq("id", groupId)
    .eq("tenant_id", ctx.tenantId);
}

export async function removeGroup(ctx: AuthContext, groupId: string) {
  await db()
    .from("discovered_groups")
    .update({ status: "REMOVED", updated_at: new Date().toISOString() })
    .eq("id", groupId)
    .eq("tenant_id", ctx.tenantId);
}

export async function approveGroup(
  ctx: AuthContext,
  groupId: string,
  connectionId?: string | null,
) {
  const client = db();
  const { data: group } = await client
    .from("discovered_groups")
    .select("*")
    .eq("id", groupId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!group) throw new Error("Group not found.");

  const { count } = await client
    .from("discovered_groups")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId)
    .in("status", ["APPROVED", "JOINED"]);
  await assertEntitlement(ctx.tenantId, "max_saved_groups", count ?? 0, 1);

  await client
    .from("discovered_groups")
    .update({
      status: "APPROVED",
      approved_at: new Date().toISOString(),
      connection_id: connectionId ?? null,
    })
    .eq("id", groupId);

  await notify(ctx.tenantId, "Group approved", `${group.title} is approved.`, "SUCCESS");
  await logSystem({ tenant_id: ctx.tenantId, action: "GROUP_APPROVED", resource: group.username });
  return { status: "APPROVED" };
}

export async function joinGroup(ctx: AuthContext, groupId: string, connectionId: string) {
  const connection = await requireConnection(ctx, connectionId);
  const client = db();
  const { data: group } = await client
    .from("discovered_groups")
    .select("*")
    .eq("id", groupId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!group) throw new Error("Group not found.");
  if (!group.username) throw new Error("Only public @username groups can be joined automatically.");

  const result = await joinGroupViaUserSession(
    ctx.tenantId,
    connection.id as string,
    group.username as string,
  );
  const status =
    result.status === "JOINED"
      ? "JOINED"
      : result.status === "INVITE_REQUIRED"
        ? "REQUIRES_ACTION"
        : result.status;

  await client
    .from("discovered_groups")
    .update({
      status,
      joined_at: result.status === "JOINED" ? new Date().toISOString() : null,
      join_error: result.error ?? null,
      connection_id: connection.id,
    })
    .eq("id", groupId)
    .eq("tenant_id", ctx.tenantId);

  await client.from("group_memberships").upsert(
    {
      tenant_id: ctx.tenantId,
      group_id: groupId,
      connection_id: connection.id,
      status,
      error: result.error ?? null,
      joined_at: result.status === "JOINED" ? new Date().toISOString() : null,
    },
    { onConflict: "group_id,connection_id" },
  );
  await clientConnectionUsed(ctx.tenantId, connection.id as string);
  await logSystem({
    tenant_id: ctx.tenantId,
    action: "GROUP_JOIN_ATTEMPT",
    resource: group.username,
  });
  return result;
}

export async function bulkJoinState(ctx: AuthContext) {
  const { data } = await db()
    .from("bulk_join_states")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  return (
    data ?? {
      tenant_id: ctx.tenantId,
      status: "IDLE",
      group_ids: [],
      current_index: 0,
      joined: 0,
      already_joined: 0,
      failed: 0,
      inaccessible: 0,
      cooldown: 0,
      last_error: null,
    }
  );
}

export async function startBulkJoin(ctx: AuthContext, connectionId: string) {
  const connection = await requireConnection(ctx, connectionId);
  const { data: groups } = await db()
    .from("discovered_groups")
    .select("id, status")
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "APPROVED");
  const ids = (groups ?? []).map((g) => g.id as string);
  await db().from("bulk_join_states").upsert(
    {
      tenant_id: ctx.tenantId,
      connection_id: connection.id,
      status: "RUNNING",
      group_ids: ids,
      current_index: 0,
      joined: 0,
      already_joined: 0,
      failed: 0,
      inaccessible: 0,
      cooldown: 0,
      last_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );
  await notify(ctx.tenantId, "Join all started", `${ids.length} approved group(s) queued.`, "INFO", "/mini-app/groups-approved");
  return bulkJoinState(ctx);
}

export async function pauseBulkJoin(ctx: AuthContext) {
  await db()
    .from("bulk_join_states")
    .update({ status: "PAUSED", updated_at: new Date().toISOString() })
    .eq("tenant_id", ctx.tenantId);
  return bulkJoinState(ctx);
}

export async function resumeBulkJoin(ctx: AuthContext) {
  await db()
    .from("bulk_join_states")
    .update({ status: "RUNNING", updated_at: new Date().toISOString() })
    .eq("tenant_id", ctx.tenantId);
  return bulkJoinState(ctx);
}

export async function processBulkJoinJobs(limit = 2) {
  const { data: states } = await db()
    .from("bulk_join_states")
    .select("*")
    .eq("status", "RUNNING")
    .limit(Math.max(1, Math.min(limit, 10)));
  let processed = 0;
  for (const state of states ?? []) {
    const ids = (state.group_ids ?? []) as string[];
    const index = Number(state.current_index ?? 0);
    if (!state.connection_id || index >= ids.length) {
      await db()
        .from("bulk_join_states")
        .update({ status: "COMPLETED", updated_at: new Date().toISOString() })
        .eq("tenant_id", state.tenant_id);
      await notify(state.tenant_id as string, "Join all completed", "Bulk group joining finished.", "SUCCESS", "/mini-app/groups-approved");
      continue;
    }
    const ctx = {
      tenantId: state.tenant_id as string,
      customerId: "",
      email: "",
      name: null,
      telegramUserId: null,
    };
    const groupId = ids[index];
    if (!groupId) break;
    const { data: group } = await db()
      .from("discovered_groups")
      .select("status")
      .eq("tenant_id", ctx.tenantId)
      .eq("id", groupId)
      .maybeSingle();
    try {
      if (!group || group.status === "JOINED") {
        await db()
          .from("bulk_join_states")
          .update({
            current_index: index + 1,
            already_joined: Number(state.already_joined ?? 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", ctx.tenantId);
      } else {
        const result = await joinGroup(ctx, groupId, state.connection_id as string);
        const patch: Record<string, unknown> = {
          current_index: index + 1,
          updated_at: new Date().toISOString(),
          last_error: result.error ?? null,
        };
        if (result.status === "JOINED") patch["joined"] = Number(state.joined ?? 0) + 1;
        else if (result.status === "RESTRICTED") {
          patch["status"] = "PAUSED";
          patch["cooldown"] = Number(state.cooldown ?? 0) + 1;
        } else if (result.status === "INVITE_REQUIRED") patch["inaccessible"] = Number(state.inaccessible ?? 0) + 1;
        else patch["failed"] = Number(state.failed ?? 0) + 1;
        await db().from("bulk_join_states").update(patch).eq("tenant_id", ctx.tenantId);
      }
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Join failed.";
      await db()
        .from("bulk_join_states")
        .update({
          current_index: index + 1,
          failed: Number(state.failed ?? 0) + 1,
          last_error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", ctx.tenantId);
    }
  }
  return { processed };
}

/* -------------------------------- add users -------------------------------------- */

function addUsersStats(results: { status?: string | null }[]) {
  return {
    selected_count: results.length,
    pending_count: results.filter((row) => row.status === "PENDING").length,
    processing_count: results.filter((row) => row.status === "PROCESSING").length,
    successful_count: results.filter((row) => row.status === "SUCCESSFUL").length,
    failed_count: results.filter((row) => row.status === "FAILED").length,
  };
}

function addUsersSchemaMissing(error?: { message?: string | null } | null) {
  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("add_users_jobs") || message.includes("add_users_job_results") || message.includes("relation") && message.includes("does not exist");
}

async function syncAddUsersJobStats(jobId: string) {
  const { data: results } = await untypedDb()
    .from("add_users_job_results")
    .select("status")
    .eq("job_id", jobId);
  const stats = addUsersStats(results ?? []);
  const done = stats.pending_count === 0 && stats.processing_count === 0;
  const patch: Record<string, unknown> = {
    ...stats,
    updated_at: new Date().toISOString(),
  };
  if (done) {
    patch["status"] = "COMPLETED";
    patch["completed_at"] = new Date().toISOString();
  }
  await untypedDb().from("add_users_jobs").update(patch).eq("id", jobId);
  return stats;
}

export async function addUsersState(ctx: AuthContext, jobId?: string | null) {
  let query = untypedDb()
    .from("add_users_jobs")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("customer_id", ctx.customerId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (jobId) query = query.eq("id", jobId);
  const { data: jobs, error } = await query;
  if (addUsersSchemaMissing(error)) return { jobs: [], job: null, results: [], migrationRequired: true };
  if (error) throw new Error(error.message);
  const selected = jobId ? (jobs ?? [])[0] : (jobs ?? []).find((job: { status?: string | null }) => ["PENDING", "RUNNING", "PAUSED", "COOLDOWN"].includes(String(job.status))) ?? (jobs ?? [])[0] ?? null;
  const { data: results } = selected
    ? await untypedDb()
      .from("add_users_job_results")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("customer_id", ctx.customerId)
      .eq("job_id", selected.id)
      .order("created_at", { ascending: true })
    : { data: [] };
  return { jobs: jobs ?? [], job: selected ?? null, results: results ?? [] };
}

export async function checkAddUsersDestination(ctx: AuthContext, input: { connectionId: string; destination: string }) {
  const connection = await requireConnection(ctx, input.connectionId);
  if (!sessionUsable(connection as Record<string, unknown>)) throw new Error("Reconnect required");
  return checkAddUsersDestinationViaUserSession(ctx.tenantId, String(connection.id), input.destination);
}

export async function startAddUsersJob(
  ctx: AuthContext,
  input: { connectionId: string; destination: string; contactIds: string[] },
) {
  const ids = [...new Set(input.contactIds)].filter(Boolean);
  if (!ids.length) throw new Error("Select at least one user.");
  const connection = await requireConnection(ctx, input.connectionId);
  if (!sessionUsable(connection as Record<string, unknown>)) throw new Error("Reconnect required");
  const destination = await checkAddUsersDestinationViaUserSession(ctx.tenantId, String(connection.id), input.destination);
  if (!destination.ok) throw new Error(destination.reason ?? "Destination unavailable");
  const { data: contacts, error } = await db()
    .from("audience_contacts")
    .select("id, telegram_user_id, access_hash, username, display_name, eligibility, tenant_id")
    .eq("tenant_id", ctx.tenantId)
    .in("id", ids)
    .eq("eligibility", "OPTED_IN");
  if (error) throw new Error(error.message);
  const rows = contacts ?? [];
  if (rows.length !== ids.length) throw new Error("Only your own discovered users can be added.");
  const { data: job, error: insertError } = await untypedDb()
    .from("add_users_jobs")
    .insert({
      tenant_id: ctx.tenantId,
      customer_id: ctx.customerId,
      connection_id: connection.id,
      destination_input: input.destination,
      destination_title: destination.title,
      destination_username: destination.username,
      destination_type: destination.destinationType,
      destination_peer_id: destination.peerId,
      selected_count: rows.length,
      pending_count: rows.length,
      status: "RUNNING",
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (insertError || !job) throw new Error(insertError?.message ?? "Could not create Add Users job.");
  const resultRows = rows.map((contact) => ({
    job_id: job.id,
    tenant_id: ctx.tenantId,
    customer_id: ctx.customerId,
    contact_id: contact.id,
    telegram_user_id: contact.telegram_user_id,
    access_hash: contact.access_hash,
    username: contact.username,
    display_name: contact.display_name,
    status: "PENDING",
  }));
  const { error: resultError } = await untypedDb().from("add_users_job_results").insert(resultRows);
  if (resultError) throw new Error(resultError.message);
  await notify(ctx.tenantId, "Add Users started", `${rows.length} user(s) queued.`, "INFO", "/mini-app/add-users");
  return addUsersState(ctx, String(job.id));
}

export async function controlAddUsersJob(ctx: AuthContext, input: { id: string; action: "PAUSE" | "RESUME" | "CANCEL" }) {
  const { data: job } = await untypedDb()
    .from("add_users_jobs")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .eq("customer_id", ctx.customerId)
    .eq("id", input.id)
    .maybeSingle();
  if (!job) throw new Error("Add Users job not found.");
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.action === "PAUSE") patch["status"] = "PAUSED";
  if (input.action === "RESUME") {
    patch["status"] = "RUNNING";
    patch["cooldown_until"] = null;
  }
  if (input.action === "CANCEL") {
    patch["status"] = "CANCELLED";
    patch["completed_at"] = new Date().toISOString();
  }
  await untypedDb()
    .from("add_users_jobs")
    .update(patch)
    .eq("tenant_id", ctx.tenantId)
    .eq("customer_id", ctx.customerId)
    .eq("id", input.id);
  return addUsersState(ctx, input.id);
}

export async function processAddUsersJobs(limit = 2) {
  const now = new Date().toISOString();
  const { data: jobs, error } = await untypedDb()
    .from("add_users_jobs")
    .select("*")
    .in("status", ["PENDING", "RUNNING", "COOLDOWN"])
    .or(`cooldown_until.is.null,cooldown_until.lte.${now}`)
    .order("updated_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 5)));
  if (addUsersSchemaMissing(error)) return { processed: 0 };
  if (error) throw new Error(error.message);
  let processed = 0;
  for (const job of jobs ?? []) {
    const { data: result } = await untypedDb()
      .from("add_users_job_results")
      .select("*")
      .eq("job_id", job.id)
      .eq("tenant_id", job.tenant_id)
      .eq("status", "PENDING")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!result) {
      await syncAddUsersJobStats(String(job.id));
      continue;
    }
    await untypedDb()
      .from("add_users_job_results")
      .update({ status: "PROCESSING", attempted_at: now, updated_at: now })
      .eq("id", result.id)
      .eq("status", "PENDING");
    const invite = await addUserToDestinationViaUserSession(String(job.tenant_id), String(job.connection_id), {
      destination: String(job.destination_input),
      contact: {
        contactId: String(result.contact_id),
        telegramUserId: result.telegram_user_id == null ? null : Number(result.telegram_user_id),
        accessHash: result.access_hash ?? null,
        username: result.username ?? null,
        displayName: result.display_name ?? null,
      },
    });
    if (invite.status === "COOLDOWN") {
      const seconds = Math.max(60, Number(invite.cooldownSeconds ?? 3600));
      const cooldownUntil = new Date(Date.now() + seconds * 1000).toISOString();
      await untypedDb()
        .from("add_users_job_results")
        .update({ status: "FAILED", reason: invite.reason, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", result.id);
      await untypedDb()
        .from("add_users_jobs")
        .update({ status: "COOLDOWN", cooldown_until: cooldownUntil, last_error: invite.reason, updated_at: new Date().toISOString() })
        .eq("id", job.id);
    } else {
      await untypedDb()
        .from("add_users_job_results")
        .update({
          status: invite.status,
          reason: invite.reason,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", result.id);
      await syncAddUsersJobStats(String(job.id));
    }
    await clientConnectionUsed(String(job.tenant_id), String(job.connection_id));
    processed += 1;
  }
  return { processed };
}

/* --------------------------------- audience --------------------------------------- */

export type AudienceUser = {
  id: string;
  telegram_user_id: number;
  access_hash?: string | null;
  display_name: string | null;
  username: string | null;
  source_group_id: string | null;
  eligibility: string;
  status: string;
  entity_status?: string | null;
  contact_count: number;
  first_found_at: string;
  last_contacted_at: string | null;
  presence_status?: string | null;
  last_seen_at?: string | null;
  recent_activity_at?: string | null;
  messages_observed?: number;
  active_source_group_ids?: string[];
  has_username?: boolean;
};

export type AudienceFilter =
  | "ALL_ELIGIBLE"
  | "ACTIVE_POSTERS"
  | "ACTIVE_30_DAYS"
  | "RECENTLY_ONLINE";

export type AudienceUsernameFilter = "ALL" | "WITH_USERNAME" | "WITHOUT_USERNAME";
export type AudienceActivityFilter = "ALL" | "ACTIVE_RECENTLY" | "AROUND_MONTH" | "LONG_TIME_AGO";

type AudienceQueryOptions = {
  groupIds?: string[];
  onlyNew?: boolean;
  filter?: AudienceFilter;
  usernameFilter?: AudienceUsernameFilter;
  activityFilter?: AudienceActivityFilter;
  excludeInactive?: boolean;
  page?: number;
  pageSize?: number;
};

const ACTIVE_PRESENCE = ["ONLINE", "RECENTLY", "WITHIN_WEEK", "WITHIN_MONTH"];
const RECENT_PRESENCE = ["ONLINE", "RECENTLY", "WITHIN_WEEK"];

function audienceColumns() {
  return "id, telegram_user_id, access_hash, display_name, username, has_username, source_group_id, eligibility, status, entity_status, contact_count, first_found_at, last_contacted_at, presence_status, last_seen_at, recent_activity_at, messages_observed, active_source_group_ids, discovered_groups(title, username)";
}

function normalizeAudienceOptions(
  groupIdsOrOptions: string[] | AudienceQueryOptions,
  onlyNew?: boolean,
): Required<AudienceQueryOptions> {
  const options = Array.isArray(groupIdsOrOptions)
    ? { groupIds: groupIdsOrOptions, onlyNew }
    : groupIdsOrOptions;
  return {
    groupIds: options.groupIds ?? [],
    onlyNew: options.onlyNew ?? true,
    filter: options.filter ?? "ALL_ELIGIBLE",
    usernameFilter: options.usernameFilter ?? "ALL",
    activityFilter: options.activityFilter ?? "ALL",
    excludeInactive: options.excludeInactive ?? true,
    page: Math.max(1, Number(options.page ?? 1)),
    pageSize: Math.max(25, Math.min(100, Number(options.pageSize ?? 100))),
  };
}

// Supabase's fluent query builder is a thenable with result typing that changes at each chained method.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AudienceQueryBuilder = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabaseClient = { from: (table: string) => any };

function untypedDb() {
  return db() as unknown as UntypedSupabaseClient;
}

function applyAudienceFilters(
  query: AudienceQueryBuilder,
  options: Required<AudienceQueryOptions>,
) {
  let q = query.eq("eligibility", "OPTED_IN");
  if (options.groupIds.length) q = q.in("source_group_id", options.groupIds);
  if (options.onlyNew) q = q.eq("contact_count", 0);
  if (options.filter === "ACTIVE_POSTERS") q = q.gt("messages_observed", 0);
  if (options.filter === "ACTIVE_30_DAYS") {
    q = q.or(
      `presence_status.in.(${ACTIVE_PRESENCE.join(",")}),recent_activity_at.gte.${new Date(Date.now() - 30 * 86_400_000).toISOString()}`,
    );
  }
  if (options.filter === "RECENTLY_ONLINE") q = q.in("presence_status", RECENT_PRESENCE);
  if (options.usernameFilter === "WITH_USERNAME") q = q.eq("has_username", true);
  if (options.usernameFilter === "WITHOUT_USERNAME") q = q.eq("has_username", false);
  if (options.activityFilter !== "ALL") {
    const fourDaysAgo = new Date(Date.now() - 4 * 86_400_000).toISOString();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();
    if (options.activityFilter === "ACTIVE_RECENTLY") {
      q = q.or(
        `last_seen_at.gte.${fourDaysAgo},and(last_seen_at.is.null,presence_status.in.(ONLINE,RECENTLY))`,
      );
    }
    if (options.activityFilter === "AROUND_MONTH") {
      q = q.or(
        `and(last_seen_at.lt.${fourDaysAgo},last_seen_at.gte.${fourteenDaysAgo}),and(last_seen_at.is.null,presence_status.in.(WITHIN_WEEK,WITHIN_MONTH))`,
      );
    }
    if (options.activityFilter === "LONG_TIME_AGO") {
      q = q.or(`last_seen_at.lt.${fourteenDaysAgo},and(last_seen_at.is.null,presence_status.eq.LONG_AGO)`);
    }
  }
  if (options.excludeInactive && options.activityFilter === "ALL") {
    q = q.neq("presence_status", "LONG_AGO");
  }
  return q;
}

function orderAudience(query: AudienceQueryBuilder) {
  return query
    .order("has_username", { ascending: false, nullsFirst: false })
    .order("messages_observed", { ascending: false, nullsFirst: false })
    .order("recent_activity_at", { ascending: false, nullsFirst: false })
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .order("first_found_at", { ascending: false });
}

function audienceCountBase(client: ReturnType<typeof db>, tenantId: string, options: Required<AudienceQueryOptions>) {
  let q = client
    .from("audience_contacts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("eligibility", "OPTED_IN");
  if (options.groupIds.length) q = q.in("source_group_id", options.groupIds);
  if (options.onlyNew) q = q.eq("contact_count", 0);
  return q;
}

export async function findAudience(
  ctx: AuthContext,
  groupIdsOrOptions: string[] | AudienceQueryOptions,
  onlyNew?: boolean,
): Promise<{
  totalFound: number;
  eligible: number;
  previouslyContacted: number;
  duplicates: number;
  excluded: number;
  excludedInactive: number;
  withUsername: number;
  activePosters: number;
  page: number;
  pageSize: number;
  showingFrom: number;
  showingTo: number;
  hasMore: boolean;
  filter: AudienceFilter;
  usernameFilter: AudienceUsernameFilter;
  activityFilter: AudienceActivityFilter;
  excludeInactive: boolean;
  users: AudienceUser[];
}> {
  const client = db();
  const options = normalizeAudienceOptions(groupIdsOrOptions, onlyNew);
  const base = client
    .from("audience_contacts")
    .select(audienceColumns(), { count: "exact" })
    .eq("tenant_id", ctx.tenantId);
  const from = (options.page - 1) * options.pageSize;
  const to = from + options.pageSize - 1;
  const { data, count } = await orderAudience(applyAudienceFilters(base, options)).range(from, to);
  const rows = (data ?? []) as unknown as AudienceUser[];

  const [allRows, eligibleCount, contactedCount, activePosters, excludedInactive, withUsername] = await Promise.all([
    client
      .from("audience_contacts")
      .select("telegram_user_id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId),
    client
      .from("audience_contacts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("eligibility", "OPTED_IN"),
    client
      .from("audience_contacts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .gt("contact_count", 0),
    client
      .from("audience_contacts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .gt("messages_observed", 0),
    audienceCountBase(client, ctx.tenantId, options).eq("presence_status", "LONG_AGO"),
    applyAudienceFilters(
      client
        .from("audience_contacts")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", ctx.tenantId),
      options,
    ).eq("has_username", true),
  ]);
  const totalAll = allRows.count ?? 0;
  const eligibleTotal = eligibleCount.count ?? 0;
  const contactedTotal = contactedCount.count ?? 0;
  const total = count ?? 0;

  return {
    totalFound: total,
    eligible: eligibleTotal,
    previouslyContacted: contactedTotal,
    duplicates: 0,
    excluded: Math.max(totalAll - eligibleTotal, 0),
    excludedInactive: excludedInactive.count ?? 0,
    withUsername: withUsername.count ?? 0,
    activePosters: activePosters.count ?? 0,
    page: options.page,
    pageSize: options.pageSize,
    showingFrom: total ? from + 1 : 0,
    showingTo: Math.min(to + 1, total),
    hasMore: to + 1 < total,
    filter: options.filter,
    usernameFilter: options.usernameFilter,
    activityFilter: options.activityFilter,
    excludeInactive: options.excludeInactive,
    users: rows,
  };
}

export async function selectAudienceIds(
  ctx: AuthContext,
  input: AudienceQueryOptions & { rangeFrom?: number | null; rangeTo?: number | null },
) {
  const options = normalizeAudienceOptions(input);
  const rangeFrom = input.rangeFrom ? Math.max(1, Number(input.rangeFrom)) : null;
  const rangeTo = input.rangeTo ? Math.max(rangeFrom ?? 1, Number(input.rangeTo)) : null;
  const from = rangeFrom ? rangeFrom - 1 : 0;
  const to = rangeTo ? rangeTo - 1 : 4999;
  const { data } = await orderAudience(applyAudienceFilters(
    db()
      .from("audience_contacts")
      .select("id")
      .eq("tenant_id", ctx.tenantId),
    options,
  )).range(from, Math.min(to, 4999));
  return { ids: (data ?? []).map((row: { id: string }) => row.id) };
}

export async function discoverAudience(
  ctx: AuthContext,
  groupIds: string[],
  connectionId?: string | null,
): Promise<{
  groupsSelected: number;
  groupsProcessed: number;
  usersFound: number;
  duplicates: number;
  alreadySaved: number;
  unavailable: number;
  results: {
    groupId: string;
    groupName: string;
    status: string;
    usersFound: number;
    duplicates: number;
    alreadySaved: number;
    reason?: string | null;
  }[];
}> {
  const ids = [...new Set(groupIds)].filter(Boolean);
  if (!ids.length) throw new Error("Select at least one approved source group.");
  const connection = connectionId ? await requireConnection(ctx, connectionId) : await defaultHealthyConnection(ctx);
  const { data: groups } = await db()
    .from("discovered_groups")
    .select("id, title, username, telegram_group_id, access_hash, entity_type, status")
    .eq("tenant_id", ctx.tenantId)
    .in("id", ids)
    .in("status", ["APPROVED", "JOINED"]);
  const rows = groups ?? [];
  if (!rows.length) throw new Error("Select approved groups before finding users.");
  await assertUsageQuota(
    ctx.tenantId,
    "audience_found",
    "monthly_audience_found_limit",
    1,
    "Monthly audience discovery limit reached.",
  );

  const summary = {
    groupsSelected: ids.length,
    groupsProcessed: 0,
    usersFound: 0,
    duplicates: 0,
    alreadySaved: 0,
    unavailable: 0,
    results: [] as {
      groupId: string;
      groupName: string;
      status: string;
      usersFound: number;
      duplicates: number;
      alreadySaved: number;
      reason?: string | null;
    }[],
  };

  for (const group of rows) {
    const result = await discoverAudienceViaUserSession(ctx.tenantId, connection.id as string, {
      username: group.username as string | null,
      telegram_group_id: group.telegram_group_id as number | null,
      access_hash: group.access_hash as string | null,
      entity_type: group.entity_type as string | null,
    });
    const groupResult = {
      groupId: group.id as string,
      groupName: String(group.title ?? group.username ?? group.id),
      status: result.status,
      usersFound: result.users.length,
      duplicates: 0,
      alreadySaved: 0,
      reason: result.reason,
    };

    if (result.status === "FOUND") {
      await assertUsageQuota(
        ctx.tenantId,
        "audience_found",
        "monthly_audience_found_limit",
        result.users.length,
        "Monthly audience discovery limit reached.",
      );
      for (const user of result.users) {
        const { data: existing } = await db()
          .from("audience_contacts")
          .select("id, access_hash, username, display_name, messages_observed, active_source_group_ids, presence_status, last_seen_at, recent_activity_at")
          .eq("tenant_id", ctx.tenantId)
          .eq("telegram_user_id", user.telegramUserId)
          .maybeSingle();
        if (existing) {
          const sourceIds = new Set<string>((existing.active_source_group_ids ?? []) as string[]);
          if (user.activePoster) sourceIds.add(group.id as string);
          await db()
            .from("audience_contacts")
            .update({
              access_hash: user.accessHash ?? existing.access_hash,
              username: user.username ?? existing.username,
              display_name: user.displayName ?? existing.display_name,
              presence_status:
                user.presenceStatus === "UNKNOWN" ? existing.presence_status : user.presenceStatus,
              last_seen_at: user.lastSeenAt ?? existing.last_seen_at,
              recent_activity_at: user.recentActivityAt ?? existing.recent_activity_at,
              messages_observed:
                Number(existing.messages_observed ?? 0) + Number(user.messagesObserved ?? 0),
              active_source_group_ids: [...sourceIds],
              last_activity_checked_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
            .eq("tenant_id", ctx.tenantId);
          groupResult.alreadySaved += 1;
          summary.alreadySaved += 1;
          continue;
        }
        const { error } = await db().from("audience_contacts").insert({
          tenant_id: ctx.tenantId,
          telegram_user_id: user.telegramUserId,
          access_hash: user.accessHash,
          username: user.username,
          display_name: user.displayName,
          source_group_id: group.id,
          source_connection_id: connection.id,
          entity_status: user.accessHash || user.username ? "RESOLVABLE" : "ENTITY_UNAVAILABLE",
          eligibility: "OPTED_IN",
          status: "NEW",
          presence_status: user.presenceStatus,
          last_seen_at: user.lastSeenAt,
          recent_activity_at: user.recentActivityAt,
          messages_observed: user.messagesObserved,
          active_source_group_ids: user.activePoster ? [group.id] : [],
          last_activity_checked_at: new Date().toISOString(),
        });
        if (error) {
          groupResult.duplicates += 1;
          summary.duplicates += 1;
        } else {
          summary.usersFound += 1;
        }
      }
    } else {
      summary.unavailable += 1;
    }

    await db().from("audience_discovery_runs").insert({
      tenant_id: ctx.tenantId,
      source_group_id: group.id,
      connection_id: connection.id,
      status: groupResult.status,
      users_found: groupResult.usersFound,
      duplicates: groupResult.duplicates,
      already_saved: groupResult.alreadySaved,
      unavailable: result.status === "FOUND" ? 0 : 1,
      reason: result.reason ?? null,
    });
    summary.groupsProcessed += 1;
    summary.results.push(groupResult);
  }
  if (summary.usersFound) await incrementMonthlyUsage(ctx.tenantId, { audience_found: summary.usersFound });
  await clientConnectionUsed(ctx.tenantId, connection.id as string);
  return summary;
}

export async function audienceDiscoveryState(ctx: AuthContext) {
  const [{ data: state }, audience] = await Promise.all([
    db().from("audience_discovery_states").select("*").eq("tenant_id", ctx.tenantId).maybeSingle(),
    findAudience(ctx, [], true),
  ]);
  const { data: issues } = await db()
    .from("audience_discovery_runs")
    .select("*, discovered_groups(title, username)")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(50);
  return {
    state:
      state ?? {
        tenant_id: ctx.tenantId,
        status: "IDLE",
        group_ids: [],
        processed_group_ids: [],
        users_found: 0,
        new_users: 0,
        duplicates: 0,
        previously_saved: 0,
        unavailable: 0,
        last_error: null,
      },
    audience,
    issues: issues ?? [],
  };
}

export async function startAudienceDiscovery(ctx: AuthContext, groupIds: string[]) {
  const ids = [...new Set(groupIds)].filter(Boolean);
  if (!ids.length) throw new Error("Select at least one approved source group.");
  const connection = await defaultHealthyConnection(ctx);
  await db().from("audience_discovery_states").upsert(
    {
      tenant_id: ctx.tenantId,
      connection_id: connection.id,
      status: "RUNNING",
      group_ids: ids,
      processed_group_ids: [],
      users_found: 0,
      new_users: 0,
      duplicates: 0,
      previously_saved: 0,
      unavailable: 0,
      last_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );
  await notify(ctx.tenantId, "Audience discovery started", `${ids.length} source group(s) queued.`, "INFO", "/mini-app/dm-audience");
  return audienceDiscoveryState(ctx);
}

export async function pauseAudienceDiscovery(ctx: AuthContext) {
  await db()
    .from("audience_discovery_states")
    .update({ status: "PAUSED", updated_at: new Date().toISOString() })
    .eq("tenant_id", ctx.tenantId);
  return audienceDiscoveryState(ctx);
}

export async function processAudienceDiscoveryJobs(limit = 2) {
  const { data: states } = await db()
    .from("audience_discovery_states")
    .select("*")
    .eq("status", "RUNNING")
    .limit(Math.max(1, Math.min(limit, 10)));
  let processed = 0;
  for (const state of states ?? []) {
    const groupIds = ((state.group_ids ?? []) as string[]).filter(Boolean);
    const done = new Set(((state.processed_group_ids ?? []) as string[]).filter(Boolean));
    const next = groupIds.find((id) => !done.has(id));
    if (!next) {
      await db()
        .from("audience_discovery_states")
        .update({ status: "COMPLETED", updated_at: new Date().toISOString() })
        .eq("tenant_id", state.tenant_id);
      await notify(state.tenant_id as string, "Audience discovery completed", "Find Users finished processing selected groups.", "SUCCESS", "/mini-app/dm-audience");
      continue;
    }
    const ctx = {
      tenantId: state.tenant_id as string,
      customerId: "",
      email: "",
      name: null,
      telegramUserId: null,
    };
    try {
      const result = await discoverAudience(ctx, [next], state.connection_id as string | null);
      done.add(next);
      await db()
        .from("audience_discovery_states")
        .update({
          processed_group_ids: [...done],
          users_found: Number(state.users_found ?? 0) + result.usersFound,
          new_users: Number(state.new_users ?? 0) + result.usersFound,
          duplicates: Number(state.duplicates ?? 0) + result.duplicates,
          previously_saved: Number(state.previously_saved ?? 0) + result.alreadySaved,
          unavailable: Number(state.unavailable ?? 0) + result.unavailable,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", state.tenant_id);
      processed += 1;
    } catch (error) {
      done.add(next);
      await db()
        .from("audience_discovery_states")
        .update({
          processed_group_ids: [...done],
          unavailable: Number(state.unavailable ?? 0) + 1,
          last_error: error instanceof Error ? error.message : "Audience discovery failed.",
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", state.tenant_id);
    }
  }
  return { processed };
}

export async function contactHistory(ctx: AuthContext) {
  const { data } = await db()
    .from("audience_contacts")
    .select("*, discovered_groups(title, username)")
    .eq("tenant_id", ctx.tenantId)
    .gt("contact_count", 0)
    .order("last_contacted_at", { ascending: false })
    .limit(200);
  return data ?? [];
}

/* -------------------------------- categories -------------------------------------- */

export async function listGroupCategories(ctx: AuthContext) {
  const client = db();
  const { data: categories } = await client
    .from("group_categories")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false });
  if (!categories?.length) return [];
  const { data: members } = await client
    .from("group_category_members")
    .select("category_id, group_id, discovered_groups(can_send_messages, writable_status, sendable_status)")
    .eq("tenant_id", ctx.tenantId)
    .in(
      "category_id",
      categories.map((c) => c.id),
    );
  const counts = new Map<string, number>();
  const usableCounts = new Map<string, number>();
  const sendableCounts = new Map<string, number>();
  for (const member of members ?? []) {
    const categoryId = member.category_id as string;
    counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
    const group = Array.isArray(member.discovered_groups)
      ? member.discovered_groups[0]
      : member.discovered_groups;
    if (group?.can_send_messages === true && group?.writable_status === "WRITABLE") {
      usableCounts.set(categoryId, (usableCounts.get(categoryId) ?? 0) + 1);
    }
    if (group?.sendable_status === "SENDABLE") {
      sendableCounts.set(categoryId, (sendableCounts.get(categoryId) ?? 0) + 1);
    }
  }
  return categories.map((category) => ({
    ...category,
    category_type: category.category_type ?? "NW_NS",
    group_count: counts.get(category.id as string) ?? 0,
    usable_count: usableCounts.get(category.id as string) ?? 0,
    sendable_count: sendableCounts.get(category.id as string) ?? 0,
    unavailable_count:
      (counts.get(category.id as string) ?? 0) - (usableCounts.get(category.id as string) ?? 0),
  }));
}

export async function groupCategoryDetail(ctx: AuthContext, id: string) {
  const client = db();
  const { data: category } = await client
    .from("group_categories")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!category) throw new Error("Category not found.");
  const { data: members } = await client
    .from("group_category_members")
    .select("group_id, discovered_groups(*)")
    .eq("tenant_id", ctx.tenantId)
    .eq("category_id", id);
  const groups = (members ?? [])
    .map((m) =>
      Array.isArray(m.discovered_groups) ? m.discovered_groups[0] : m.discovered_groups,
    )
    .filter(Boolean);
  const usableCount = groups.filter(
    (g) => g.can_send_messages === true && g.writable_status === "WRITABLE",
  ).length;
  const sendableCount = groups.filter((g) => g.sendable_status === "SENDABLE").length;
  return {
    category: { ...category, category_type: category.category_type ?? "NW_NS" },
    groups,
    usable_count: usableCount,
    sendable_count: sendableCount,
    unavailable_count: groups.length - usableCount,
  };
}

async function applySuccessfulSendWritableProof(ctx: AuthContext) {
  const client = db();
  const { data: targets } = await client
    .from("campaign_groups")
    .select("group_id")
    .eq("tenant_id", ctx.tenantId)
    .eq("status", "SENT")
    .limit(5000);
  const groupIds = [...new Set((targets ?? []).map((target) => target.group_id as string).filter(Boolean))];
  if (!groupIds.length) return 0;
  const { error } = await client
    .from("discovered_groups")
    .update({
      can_send_messages: true,
      writable_status: "WRITABLE",
      sendable_status: "SENDABLE",
      sendable_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", ctx.tenantId)
    .in("id", groupIds);
  if (error) throw new Error(error.message);
  return groupIds.length;
}

export async function groupWritabilitySummary(ctx: AuthContext) {
  const client = db();
  await applySuccessfulSendWritableProof(ctx);
  const [total, writable, sendable, notWritable, unknown] = await Promise.all([
    client
      .from("discovered_groups")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .in("status", ["APPROVED", "JOINED"]),
    client
      .from("discovered_groups")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .in("status", ["APPROVED", "JOINED"])
      .eq("can_send_messages", true)
      .eq("writable_status", "WRITABLE"),
    client
      .from("discovered_groups")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .in("status", ["APPROVED", "JOINED"])
      .eq("sendable_status", "SENDABLE"),
    client
      .from("discovered_groups")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .in("status", ["APPROVED", "JOINED"])
      .eq("writable_status", "NOT_WRITABLE"),
    client
      .from("discovered_groups")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .in("status", ["APPROVED", "JOINED"])
      .or("writable_status.is.null,writable_status.eq.UNKNOWN,can_send_messages.is.null"),
  ]);
  return {
    total: total.count ?? 0,
    writable: writable.count ?? 0,
    sendable: sendable.count ?? 0,
    notWritable: notWritable.count ?? 0,
    unknown: unknown.count ?? 0,
  };
}

type GroupCheckMode = "WRITABLE" | "SENDABLE";

function definitiveGroupStatus(status: string | null | undefined) {
  return ["NOT_WRITABLE", "NOT_SENDABLE", "INACCESSIBLE"].includes(String(status));
}

function unresolvedGroupFilter() {
  return [
    "writable_status.is.null",
    "writable_status.eq.UNKNOWN",
    "sendable_status.is.null",
    "sendable_status.eq.UNKNOWN",
    "can_send_messages.is.null",
  ].join(",");
}

async function runAutoGroupChecks(
  ctx: AuthContext,
  input: { groupIds: string[]; joinIfRequired?: boolean; mode: GroupCheckMode; limit?: number },
) {
  const ids = [...new Set(input.groupIds)].slice(0, input.limit ?? 100);
  if (!ids.length) throw new Error("Select at least one group to test.");
  const client = db();
  const { data: rows, error } = await client
    .from("discovered_groups")
    .select("id, title, username, telegram_group_id, access_hash, entity_type, writable_status, sendable_status")
    .eq("tenant_id", ctx.tenantId)
    .in("status", ["APPROVED", "JOINED"])
    .in("id", ids);
  if (error) throw new Error(error.message);
  const sessions = await eligibleTenantSessions(ctx.tenantId);
  if (!sessions.length) throw new Error("Connect an authorized Telegram session first.");

  const result = {
    checked: 0,
    total: rows?.length ?? 0,
    writable: 0,
    sendable: 0,
    notWritable: 0,
    notSendable: 0,
    joinRequired: 0,
    inaccessible: 0,
    unknown: 0,
    joined: 0,
    errors: [] as { group: string; reason: string; raw?: string | null; classification?: string | null }[],
    groups: [] as Record<string, unknown>[],
  };

  for (const group of rows ?? []) {
    result.checked += 1;
    let final: Record<string, unknown> | null = null;
    let usedConnectionId: string | null = null;
    for (const session of sessions) {
      usedConnectionId = String(session.id);
      const args = {
        username: group.username as string | null,
        telegram_group_id: group.telegram_group_id as number | null,
        access_hash: group.access_hash as string | null,
        entity_type: group.entity_type as string | null,
      };
      const tested =
        input.mode === "SENDABLE"
          ? await testGroupSendableViaUserSession(ctx.tenantId, usedConnectionId, args)
          : await verifyGroupWritableViaUserSession(ctx.tenantId, usedConnectionId, args);
      let status = String(
        input.mode === "SENDABLE"
          ? (tested as Record<string, unknown>).sendableStatus
          : (tested as Record<string, unknown>).writableStatus,
      );
      if (status === "JOIN_REQUIRED" && input.joinIfRequired && group.username) {
        const joined = await joinGroupViaUserSession(ctx.tenantId, usedConnectionId, String(group.username));
        if (joined.status === "JOINED") {
          result.joined += 1;
          const retried =
            input.mode === "SENDABLE"
              ? await testGroupSendableViaUserSession(ctx.tenantId, usedConnectionId, args)
              : await verifyGroupWritableViaUserSession(ctx.tenantId, usedConnectionId, args);
          final = retried as Record<string, unknown>;
          status = String(input.mode === "SENDABLE" ? final.sendableStatus : final.writableStatus);
        } else {
          final = {
            ...tested,
            reason: joined.error ?? "Join failed.",
            rawError: joined.error ?? null,
          } as Record<string, unknown>;
        }
      } else {
        final = tested as Record<string, unknown>;
      }
      if (
        (input.mode === "SENDABLE" && status === "SENDABLE") ||
        (input.mode === "WRITABLE" && status === "WRITABLE")
      ) {
        break;
      }
      if (status === "JOIN_REQUIRED" || definitiveGroupStatus(status)) break;
    }
    if (!final) continue;
    const status = String(input.mode === "SENDABLE" ? final.sendableStatus : final.writableStatus);
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (final.title) patch.title = final.title;
    if (final.username) patch.username = final.username;
    if (final.telegramGroupId) patch.telegram_group_id = final.telegramGroupId;
    if ("accessHash" in final) patch.access_hash = final.accessHash;
    if (final.entityType) patch.entity_type = final.entityType;
    if (input.mode === "SENDABLE") {
      patch.sendable_status = status;
      patch.sendable_checked_at = new Date().toISOString();
      patch.last_send_test_connection_id = usedConnectionId;
      patch.last_send_error = final.reason ?? final.rawError ?? null;
      if (status === "SENDABLE") {
        patch.can_send_messages = true;
        patch.writable_status = "WRITABLE";
      }
    } else {
      patch.can_send_messages = status === "WRITABLE" ? true : status === "UNKNOWN" || status === "JOIN_REQUIRED" ? null : false;
      patch.writable_status = status;
      patch.writable_checked_at = new Date().toISOString();
      patch.last_write_error = final.reason ?? final.rawError ?? null;
      patch.last_resolved_connection_id = usedConnectionId;
    }
    const { data: updated } = await client
      .from("discovered_groups")
      .update(patch)
      .eq("tenant_id", ctx.tenantId)
      .eq("id", group.id)
      .select("*")
      .maybeSingle();
    if (updated) result.groups.push(updated as Record<string, unknown>);
    if (status === "WRITABLE") result.writable += 1;
    else if (status === "SENDABLE") result.sendable += 1;
    else if (status === "NOT_WRITABLE") result.notWritable += 1;
    else if (status === "NOT_SENDABLE") result.notSendable += 1;
    else if (status === "JOIN_REQUIRED") result.joinRequired += 1;
    else if (status === "INACCESSIBLE") result.inaccessible += 1;
    else result.unknown += 1;
    if (final.reason) {
      result.errors.push({
        group: String(group.title ?? group.username ?? group.id),
        reason: String(final.reason),
        raw: final.rawError ? String(final.rawError) : null,
        classification: final.classification ? String(final.classification) : null,
      });
    }
  }
  return { ...result, summary: await groupWritabilitySummary(ctx) };
}

export async function verifyWritableGroups(
  ctx: AuthContext,
  input: { limit?: number; joinIfRequired?: boolean } = {},
) {
  const client = db();
  const proofCount = await applySuccessfulSendWritableProof(ctx);
  const { data: unknownGroups } = await client
    .from("discovered_groups")
    .select("id, title, username, telegram_group_id, access_hash, entity_type")
    .eq("tenant_id", ctx.tenantId)
    .in("status", ["APPROVED", "JOINED"])
    .or(unresolvedGroupFilter())
    .order("updated_at", { ascending: true, nullsFirst: true })
    .limit(Math.max(1, Math.min(100, Number(input.limit) || 40)));
  const rows = unknownGroups ?? [];
  const result = {
    checked: 0,
    total: rows.length,
    writable: proofCount,
    sendable: 0,
    notWritable: 0,
    notSendable: 0,
    unknown: 0,
    joinRequired: 0,
    inaccessible: 0,
    joined: 0,
    errors: [] as { group: string; reason: string }[],
  };
  if (!rows.length) return { ...result, summary: await groupWritabilitySummary(ctx) };
  await assertUsageQuota(
    ctx.tenantId,
    "writable_checks",
    "monthly_writable_check_limit",
    rows.length,
    "Monthly writable check limit reached.",
  );
  const writableChecked = await runAutoGroupChecks(ctx, {
    groupIds: rows.map((row) => String(row.id)),
    mode: "WRITABLE",
    limit: input.limit,
    joinIfRequired: input.joinIfRequired,
  });
  const sendableCandidates = (writableChecked.groups ?? [])
    .filter((group) => {
      const writable = String(group.writable_status ?? "");
      const sendable = String(group.sendable_status ?? "");
      return (
        writable === "WRITABLE" &&
        (!sendable || sendable === "UNKNOWN" || sendable === "JOIN_REQUIRED")
      );
    })
    .map((group) => String(group.id));
  let sendableChecked: Awaited<ReturnType<typeof runAutoGroupChecks>> | null = null;
  if (sendableCandidates.length) {
    await assertUsageQuota(
      ctx.tenantId,
      "sendable_checks",
      "monthly_sendable_check_limit",
      sendableCandidates.length,
      "Monthly sendable check limit reached.",
    );
    sendableChecked = await runAutoGroupChecks(ctx, {
      groupIds: sendableCandidates,
      mode: "SENDABLE",
      limit: input.limit,
      joinIfRequired: input.joinIfRequired,
    });
  }
  result.checked = writableChecked.checked + (sendableChecked?.checked ?? 0);
  result.writable += writableChecked.writable;
  result.sendable = sendableChecked?.sendable ?? 0;
  result.notWritable = writableChecked.notWritable;
  result.notSendable = sendableChecked?.notSendable ?? 0;
  result.joinRequired = writableChecked.joinRequired + (sendableChecked?.joinRequired ?? 0);
  result.inaccessible = writableChecked.inaccessible + (sendableChecked?.inaccessible ?? 0);
  result.joined = writableChecked.joined + (sendableChecked?.joined ?? 0);
  result.unknown =
    writableChecked.unknown +
    (sendableChecked?.unknown ?? 0) +
    result.joinRequired +
    result.inaccessible;
  result.errors = [...writableChecked.errors, ...(sendableChecked?.errors ?? [])].map((error) => ({
    group: error.group,
    reason: error.reason,
  }));
  await notify(
    ctx.tenantId,
    "Group verification completed",
    `Verified ${result.checked} check(s). Writable: ${result.writable}. Sendable: ${result.sendable}. Not writable: ${result.notWritable}. Unknown: ${result.unknown}.`,
    "INFO",
    "/mini-app/group-categories",
  );
  if (writableChecked.checked) await incrementMonthlyUsage(ctx.tenantId, { writable_checks: writableChecked.checked });
  if (sendableChecked?.checked) await incrementMonthlyUsage(ctx.tenantId, { sendable_checks: sendableChecked.checked });
  return { ...result, summary: await groupWritabilitySummary(ctx) };
}

export async function testWritableGroups(
  ctx: AuthContext,
  input: { groupIds: string[]; joinIfRequired?: boolean },
) {
  await assertUsageQuota(
    ctx.tenantId,
    "writable_checks",
    "monthly_writable_check_limit",
    input.groupIds.length,
    "Monthly writable check limit reached.",
  );
  const result = await runAutoGroupChecks(ctx, { ...input, mode: "WRITABLE" });
  if (result.checked) await incrementMonthlyUsage(ctx.tenantId, { writable_checks: result.checked });
  if (input.groupIds.length > 1) {
    await notify(
      ctx.tenantId,
      "Writable group test completed",
      `Tested ${result.checked}/${result.total}. Writable: ${result.writable}. Not writable: ${result.notWritable}. Unknown: ${result.unknown}. Join required: ${result.joinRequired}.`,
      "INFO",
      "/mini-app/groups-approved",
    );
  }
  return result;
}

export async function testSendableGroups(
  ctx: AuthContext,
  input: { groupIds: string[]; joinIfRequired?: boolean },
) {
  await assertUsageQuota(
    ctx.tenantId,
    "sendable_checks",
    "monthly_sendable_check_limit",
    input.groupIds.length,
    "Monthly sendable check limit reached.",
  );
  const result = await runAutoGroupChecks(ctx, { ...input, mode: "SENDABLE" });
  if (result.checked) await incrementMonthlyUsage(ctx.tenantId, { sendable_checks: result.checked });
  if (input.groupIds.length > 1) {
    await notify(
      ctx.tenantId,
      "Sendable group test completed",
      `Tested ${result.checked}/${result.total}. Sendable: ${result.sendable}. Not sendable: ${result.notSendable}. Unknown: ${result.unknown}. Join required: ${result.joinRequired}.`,
      "INFO",
      "/mini-app/groups-approved",
    );
  }
  return result;
}

export async function saveGroupCategory(
  ctx: AuthContext,
  input: {
    id?: string | null;
    name: string;
    group_ids: string[];
    category_type?: "NW_NS" | "WRITABLE" | "SENDABLE";
    joinIfRequired?: boolean;
  },
) {
  const client = db();
  const name = input.name.trim();
  if (!name) throw new Error("Category name is required.");
  const ids = [...new Set(input.group_ids)];
  if (!ids.length) throw new Error("Select at least one approved group.");
  const categoryType = input.category_type ?? "NW_NS";
  const groupQuery = client
    .from("discovered_groups")
    .select("id, can_send_messages, writable_status, sendable_status, entity_type")
    .eq("tenant_id", ctx.tenantId)
    .in("id", ids)
    .in("status", ["APPROVED", "JOINED"]);
  const { data: groups } = await groupQuery;
  if ((groups ?? []).length !== ids.length) {
    throw new Error("One or more selected groups are not approved.");
  }
  const existingIds = new Set<string>();
  if (input.id) {
    const { data: existingMembers } = await client
      .from("group_category_members")
      .select("group_id")
      .eq("tenant_id", ctx.tenantId)
      .eq("category_id", input.id);
    for (const member of existingMembers ?? []) {
      if (member.group_id) existingIds.add(String(member.group_id));
    }
  }
  const finalIds = ids;
  if (categoryType === "WRITABLE") {
    const validIds = new Set(
      (groups ?? [])
        .filter((group) => group.can_send_messages === true && group.writable_status === "WRITABLE")
        .map((group) => String(group.id)),
    );
    const invalidIds = ids.filter((id) => !validIds.has(id) && !existingIds.has(id));
    if (invalidIds.length) {
      throw new Error("One or more selected groups do not have persisted WRITABLE status.");
    }
  }
  if (categoryType === "SENDABLE") {
    const validIds = new Set(
      (groups ?? [])
        .filter((group) => group.sendable_status === "SENDABLE")
        .map((group) => String(group.id)),
    );
    const invalidIds = ids.filter((id) => !validIds.has(id) && !existingIds.has(id));
    if (invalidIds.length) {
      throw new Error("One or more selected groups do not have persisted SENDABLE status.");
    }
  }
  if (!finalIds.length) {
    throw new Error(
      categoryType === "SENDABLE"
        ? "No selected groups have persisted SENDABLE status. Run CHECK SENDABLE GROUPS first."
        : categoryType === "WRITABLE"
          ? "No selected groups have persisted WRITABLE status. Run CHECK WRITABLE GROUPS first."
          : "Select at least one approved group.",
    );
  }

  let categoryId = input.id ?? null;
  if (!categoryId) {
    const { count } = await client
      .from("group_categories")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId);
    await assertEntitlement(ctx.tenantId, "max_categories", count ?? 0, 1);
  }
  if (categoryId) {
    const { error } = await client
      .from("group_categories")
      .update({ name, category_type: categoryType, updated_at: new Date().toISOString() })
      .eq("id", categoryId)
      .eq("tenant_id", ctx.tenantId);
    if (error) throw new Error(error.message);
  } else {
    const { data: category, error } = await client
      .from("group_categories")
      .insert({ tenant_id: ctx.tenantId, name, category_type: categoryType })
      .select("*")
      .single();
    if (error || !category) throw new Error(error?.message ?? "Could not create category.");
    categoryId = category.id as string;
  }

  await client
    .from("group_category_members")
    .delete()
    .eq("tenant_id", ctx.tenantId)
    .eq("category_id", categoryId);
  await client.from("group_category_members").insert(
    finalIds.map((groupId) => ({
      tenant_id: ctx.tenantId,
      category_id: categoryId,
      group_id: groupId,
    })),
  );
  return groupCategoryDetail(ctx, categoryId);
}

export async function deleteGroupCategory(ctx: AuthContext, id: string) {
  await db().from("group_categories").delete().eq("id", id).eq("tenant_id", ctx.tenantId);
  return { ok: true };
}

/* --------------------------------- templates -------------------------------------- */

export async function listTemplates(ctx: AuthContext) {
  const { data } = await db()
    .from("message_templates")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function saveTemplate(
  ctx: AuthContext,
  input: {
    id?: string | null;
    name: string;
    body: string;
    media_type?: string | null;
    media_url?: string | null;
    buttons?: { text: string; url: string }[];
  },
) {
  const client = db();
  const row = {
    tenant_id: ctx.tenantId,
    name: input.name.trim() || "Untitled template",
    body: input.body ?? "",
    media_type: input.media_type ?? null,
    media_url: input.media_url ?? null,
    buttons: input.buttons ?? [],
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { data, error } = await client
      .from("message_templates")
      .update(row)
      .eq("id", input.id)
      .eq("tenant_id", ctx.tenantId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
  const { data, error } = await client.from("message_templates").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTemplate(ctx: AuthContext, id: string) {
  await db().from("message_templates").delete().eq("id", id).eq("tenant_id", ctx.tenantId);
}

/* --------------------------------- campaigns -------------------------------------- */

export async function listCampaigns(ctx: AuthContext, filter?: string) {
  const client = db();
  let q = client
    .from("campaigns")
    .select("*, group_categories(name)")
    .eq("tenant_id", ctx.tenantId)
    .is("deleted_at", null);
  if (filter && ["GROUP", "DM", "GROUP_DM"].includes(filter)) q = q.eq("type", filter);
  else if (filter && filter !== "ALL") q = q.eq("status", filter);
  const { data } = await q.order("created_at", { ascending: false }).limit(200);
  const rows = data ?? [];
  const stats = await campaignJobStatsMap(
    client,
    ctx.tenantId,
    rows.map((row) => row.id as string),
  );
  return rows.map((row) => withCampaignJobStats(row, stats.get(row.id as string)));
}

export async function campaignDetail(ctx: AuthContext, id: string) {
  const client = db();
  const { data: campaign } = await client
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!campaign) throw new Error("Campaign not found.");
  const [{ data: groups }, { data: recipients }, { data: logs }, stats] = await Promise.all([
    client
      .from("campaign_groups")
      .select("*, discovered_groups(title, username)")
      .eq("tenant_id", ctx.tenantId)
      .eq("campaign_id", id),
    client
      .from("campaign_recipients")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("campaign_id", id)
      .limit(500),
    client
      .from("campaign_logs")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .eq("campaign_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    campaignJobStatsMap(client, ctx.tenantId, [id]),
  ]);
  const rawLogs = logs ?? [];
  const successLogs = rawLogs.filter((log) => log.level === "INFO" && log.message === "Message sent.");
  const compactSuccess =
    successLogs.length > 1
      ? [
          {
            id: `compact-success-${id}`,
            tenant_id: ctx.tenantId,
            campaign_id: id,
            level: "INFO",
            message: `${successLogs.length} messages sent successfully.`,
            details: { compacted: true, count: successLogs.length },
            created_at: successLogs[0]?.created_at,
          },
        ]
      : successLogs;
  const priorityLogs = rawLogs
    .filter((log) => !(log.level === "INFO" && log.message === "Message sent."))
    .sort((a, b) => {
      const rank = (level: unknown) => (level === "ERROR" ? 0 : level === "WARNING" ? 1 : 2);
      return rank(a.level) - rank(b.level);
    });
  return {
    campaign: withCampaignJobStats(campaign, stats.get(id)),
    groups: groups ?? [],
    recipients: recipients ?? [],
    logs: [...priorityLogs, ...compactSuccess].slice(0, 100),
  };
}

export async function createCampaign(
  ctx: AuthContext,
  input: {
    name: string;
    type: "GROUP" | "DM" | "GROUP_DM";
    connection_id?: string | null;
    template_id?: string | null;
    message: {
      text?: string;
      entities?: {
        type: "custom_emoji" | "bold" | "italic" | "underline" | "strikethrough" | "spoiler" | "text_url";
        offset: number;
        length: number;
        document_id?: string;
        fallback?: string;
        url?: string;
        premium_required?: boolean;
      }[];
      media_type?: string | null;
      media_url?: string | null;
      buttons?: { text: string; url: string }[];
    };
    group_ids: string[];
    group_category_id?: string | null;
    contact_ids: string[];
    audience_filters?: {
      usernameFilter?: AudienceUsernameFilter;
      activityFilter?: AudienceActivityFilter;
      filter?: AudienceFilter;
      onlyNew?: boolean;
      excludeInactive?: boolean;
    } | null;
    scheduled_at?: string | null;
    start_now: boolean;
    exclude_previously_contacted?: boolean;
    min_delay_seconds?: number | null;
    max_delay_seconds?: number | null;
    cycle_delay_minutes?: number | null;
  },
) {
  const client = db();
  let groupIds = [...new Set(input.group_ids ?? [])];
  let categoryGroupCount = groupIds.length;
  if (input.group_category_id) {
    const { data: category } = await client
      .from("group_categories")
      .select("id")
      .eq("id", input.group_category_id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

    if (!category) {
      throw new Error(
        "Selected group category was not found.",
      );
    }

    const { data: members, error: membersError } = await client
      .from("group_category_members")
      .select("group_id")
      .eq("tenant_id", ctx.tenantId)
      .eq("category_id", input.group_category_id);
    if (membersError) throw new Error(membersError.message);
    groupIds = [...new Set((members ?? []).map((member) => member.group_id as string).filter(Boolean))];
    categoryGroupCount = groupIds.length;
  }

  const minDelay = Math.max(
    1,
    Number(input.min_delay_seconds ?? 30),
  );

  const maxDelay = Math.max(
    1,
    Number(input.max_delay_seconds ?? 60),
  );

  if (minDelay > maxDelay) {
    throw new Error(
      "Minimum delay must be less than or equal to maximum delay.",
    );
  }

  const cycleDelay = Math.max(
    1,
    Number(input.cycle_delay_minutes ?? 20),
  );

  if (!input.name.trim()) {
    throw new Error(
      "Give the campaign a name.",
    );
  }

  if (
    !input.message.text &&
    !input.message.media_url
  ) {
    throw new Error(
      "The message cannot be empty.",
    );
  }

  if (
    input.type !== "DM" &&
    groupIds.length === 0
  ) {
    throw new Error(
      "Select at least one group.",
    );
  }

  if (
    input.type !== "GROUP" &&
    input.contact_ids.length === 0
  ) {
    throw new Error(
      "Select at least one recipient.",
    );
  }

  const connection = await requireConnection(
    ctx,
    input.connection_id,
  );
  await validateSendingSessionForCustomEmoji(ctx, connection, input.message);

  let campaignGroups: { id: string }[] = [];

  if (input.type !== "DM" && groupIds.length) {
    const { data: groups, error: groupsError } = await client
      .from("discovered_groups")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .in("id", groupIds)
      .in("status", ["APPROVED", "JOINED"]);
    if (groupsError) throw new Error(groupsError.message);
    campaignGroups = ((groups ?? []) as { id: string }[]);
    groupIds = campaignGroups.map((g) => g.id);
    if (!groupIds.length) {
      throw new Error("Selected category has no approved saved groups.");
    }
  }

  const targetCount =
    groupIds.length +
    input.contact_ids.length;

  const { count: activeCampaignCount } = await client
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId)
    .in("status", ["RUNNING", "SCHEDULED", "PENDING_APPROVAL", "PAUSED"]);
  await assertEntitlement(
    ctx.tenantId,
    "max_active_campaigns",
    activeCampaignCount ?? 0,
    1,
    "Upgrade your plan to create more campaigns.",
  );
  if (targetCount) {
    await assertUsageQuota(
      ctx.tenantId,
      "promotion_messages",
      "monthly_message_limit",
      targetCount,
      "This campaign exceeds your monthly promotion message limit.",
    );
  }
  if (input.type !== "GROUP" && input.contact_ids.length) {
    await assertUsageQuota(
      ctx.tenantId,
      "dm_messages",
      "monthly_dm_message_limit",
      input.contact_ids.length,
      "This campaign exceeds your monthly DM message limit.",
    );
  }

  const status = input.start_now
    ? "RUNNING"
    : input.scheduled_at
      ? "SCHEDULED"
      : "PENDING_APPROVAL";
  const normalizedMessage = {
    ...input.message,
    entities: normalizeMessageEntities(input.message.entities ?? [], input.message.text ?? ""),
  };

  const { data: campaign, error } =
    await client
      .from("campaigns")
      .insert({
        tenant_id: ctx.tenantId,
        name: input.name.trim(),
        type: input.type,
        status,
        connection_id:
          input.connection_id ?? null,
        template_id:
          input.template_id ?? null,
        message: normalizedMessage,
        message_entities: normalizedMessage.entities,
        group_category_id:
          input.group_category_id ?? null,
        min_delay_seconds: minDelay,
        max_delay_seconds: maxDelay,
        cycle_delay_minutes: cycleDelay,
        scheduled_at:
          input.scheduled_at ?? null,
        started_at: input.start_now
          ? new Date().toISOString()
          : null,
        total_targets: targetCount,
      })
      .select("*")
      .single();

  if (error || !campaign) {
    throw new Error(
      error?.message ??
        "Could not create the campaign.",
    );
  }

  if (groupIds.length) {
    const rows = campaignGroups.map(
      (group) => ({
        campaign_id: campaign.id,
        tenant_id: ctx.tenantId,
        group_id: group.id,
        status: "PENDING",
      }),
    );

    if (rows.length) {
      const { error: groupInsertError } =
        await client
          .from("campaign_groups")
          .upsert(rows, {
            onConflict:
              "campaign_id,group_id",
          });

      if (groupInsertError) {
        await client
          .from("campaigns")
          .delete()
          .eq("id", campaign.id)
          .eq("tenant_id", ctx.tenantId);

        throw new Error(
          groupInsertError.message,
        );
      }
    }
  }

  /*
   * DM TARGETS
   *
   * Existing DM logic remains unchanged.
   */
  if (input.contact_ids.length) {
    const filterOptions = normalizeAudienceOptions({
      groupIds: [],
      onlyNew: input.audience_filters?.onlyNew ?? input.exclude_previously_contacted !== false,
      filter: input.audience_filters?.filter ?? "ALL_ELIGIBLE",
      usernameFilter: input.audience_filters?.usernameFilter ?? "ALL",
      activityFilter: input.audience_filters?.activityFilter ?? "ALL",
      excludeInactive: input.audience_filters?.excludeInactive ?? input.exclude_previously_contacted !== false,
    });
    const contactQuery = applyAudienceFilters(
      client
        .from("audience_contacts")
        .select("id, telegram_user_id")
        .eq("tenant_id", ctx.tenantId)
        .in("id", input.contact_ids),
      filterOptions,
    );

    const { data: contacts } =
      await contactQuery;

    /*
     * Deduplicate by Telegram user id so a user present
     * in multiple groups receives this campaign once.
     */
    const unique = new Map<
      number,
      {
        id: string;
        telegram_user_id: number;
      }
    >();

    for (const contact of contacts ?? []) {
      unique.set(
        contact.telegram_user_id as number,
        contact as never,
      );
    }

    if (unique.size === 0) {
      await client
        .from("campaigns")
        .delete()
        .eq("id", campaign.id)
        .eq("tenant_id", ctx.tenantId);

      throw new Error(
        "No selected recipients are eligible for DM promotion.",
      );
    }

    const rows = [
      ...unique.values(),
    ].map((contact) => ({
      campaign_id: campaign.id,
      tenant_id: ctx.tenantId,
      contact_id: contact.id,
      telegram_user_id:
        contact.telegram_user_id,
      status: "PENDING",
    }));

    if (rows.length) {
      await client
        .from("campaign_recipients")
        .upsert(rows, {
          onConflict:
            "campaign_id,telegram_user_id",
        });
    }
  }

  /*
   * Existing campaign worker/job creation remains
   * responsible for the real send attempts.
   */
  await enqueueCampaignJobs(
    campaign.id as string,
    ctx.tenantId,
    input.start_now,
  );

  /*
   * Recalculate real target counts after rows have been
   * created.
   */
  const groupCount =
    (
      await client
        .from("campaign_groups")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "campaign_id",
          campaign.id,
        )
    ).count ?? 0;

  const recipientCount =
    (
      await client
        .from("campaign_recipients")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "campaign_id",
          campaign.id,
        )
    ).count ?? 0;

  await client
    .from("campaigns")
    .update({
      total_targets:
        groupCount + recipientCount,
    })
    .eq("id", campaign.id);
  await client
    .from("campaign_logs")
    .insert({
      tenant_id: ctx.tenantId,
      campaign_id: campaign.id,
      level: "INFO",
      message:
        "Campaign approved and jobs created.",
      details: {
        groups: groupCount,
        recipients: recipientCount,
        connection_id: connection.id,
        category_groups:
          categoryGroupCount ||
          groupCount,
        unavailable_groups: Math.max((categoryGroupCount || groupCount) - groupCount, 0),
      },
    });

  await clientConnectionUsed(
    ctx.tenantId,
    connection.id as string,
  );

  await logSystem({
    tenant_id: ctx.tenantId,
    customer_id: ctx.customerId,
    action: "CAMPAIGN_CREATED",
    resource: campaign.name,
  });

  await notify(
    ctx.tenantId,
    "Campaign created",
    `${campaign.name} is ${status.toLowerCase()}.`,
  );

  return campaign;
}

export async function updateCampaign(
  ctx: AuthContext,
  id: string,
  input: {
    name: string;
    connection_id?: string | null;
    group_category_id?: string | null;
    message: {
      text?: string;
      entities?: {
        type: "custom_emoji" | "bold" | "italic" | "underline" | "strikethrough" | "spoiler" | "text_url";
        offset: number;
        length: number;
        document_id?: string;
        fallback?: string;
        url?: string;
        premium_required?: boolean;
      }[];
      media_type?: string | null;
      media_url?: string | null;
      buttons?: { text: string; url: string }[];
    };
    min_delay_seconds?: number | null;
    max_delay_seconds?: number | null;
    cycle_delay_minutes?: number | null;
  },
) {
  const minDelay = Math.max(1, Number(input.min_delay_seconds ?? 30));
  const maxDelay = Math.max(1, Number(input.max_delay_seconds ?? 60));
  if (minDelay > maxDelay) throw new Error("Minimum delay must be less than or equal to maximum delay.");
  if (!input.name.trim()) throw new Error("Campaign name is required.");
  if (!input.message.text && !input.message.media_url) throw new Error("Message cannot be empty.");
  if (input.connection_id) {
    const connection = await requireConnection(ctx, input.connection_id);
    await validateSendingSessionForCustomEmoji(ctx, connection, input.message);
  }
  const normalizedMessage = {
    ...input.message,
    entities: normalizeMessageEntities(input.message.entities ?? [], input.message.text ?? ""),
  };
  const { data, error } = await db()
    .from("campaigns")
    .update({
      name: input.name.trim(),
      connection_id: input.connection_id ?? null,
      group_category_id: input.group_category_id ?? null,
      message: normalizedMessage,
      message_entities: normalizedMessage.entities,
      min_delay_seconds: minDelay,
      max_delay_seconds: maxDelay,
      cycle_delay_minutes: Math.max(1, Number(input.cycle_delay_minutes ?? 20)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCampaign(ctx: AuthContext, id: string) {
  const client = db();
  await client
    .from("campaigns")
    .update({ status: "DELETED", deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId);
  await client
    .from("campaign_jobs")
    .update({ status: "CANCELLED" })
    .eq("campaign_id", id)
    .eq("tenant_id", ctx.tenantId)
    .in("status", ["QUEUED", "HELD", "PAUSED"]);
  return { ok: true };
}

export async function enqueueCampaignJobs(campaignId: string, tenantId: string, startNow: boolean) {
  const client = db();
  const [{ data: campaign }, { data: groups }, { data: recipients }] = await Promise.all([
    client
      .from("campaigns")
      .select("connection_id")
      .eq("id", campaignId)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    client.from("campaign_groups").select("id").eq("campaign_id", campaignId),
    client.from("campaign_recipients").select("id").eq("campaign_id", campaignId),
  ]);
  const jobs = [
    ...(groups ?? []).map((g) => ({ job_type: "GROUP", target_id: g.id as string })),
    ...(recipients ?? []).map((r) => ({ job_type: "DM", target_id: r.id as string })),
  ].map((j) => ({
    campaign_id: campaignId,
    tenant_id: tenantId,
    connection_id: campaign?.connection_id ?? null,
    job_type: j.job_type,
    target_id: j.target_id,
    status: startNow ? "QUEUED" : "HELD",
  }));
  if (jobs.length)
    await client
      .from("campaign_jobs")
      .upsert(jobs, { onConflict: "campaign_id,job_type,target_id", ignoreDuplicates: true });
}

export async function controlCampaign(
  ctx: AuthContext,
  id: string,
  action: "START" | "PAUSE" | "RESUME" | "RESTART" | "STOP",
) {
  const client = db();
  const { data: campaign } = await client
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!campaign) throw new Error("Campaign not found.");

  const map = {
    START: "RUNNING",
    RESUME: "RUNNING",
    RESTART: "RUNNING",
    PAUSE: "PAUSED",
    STOP: "CANCELLED",
  } as const;
  const status = map[action];
  await client
    .from("campaigns")
    .update({
      status,
      started_at: campaign.started_at ?? (status === "RUNNING" ? new Date().toISOString() : null),
      completed_at: status === "CANCELLED" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (status === "RUNNING") {
    await client
      .from("campaign_jobs")
      .update({ status: "QUEUED" })
      .eq("campaign_id", id)
      .in("status", ["HELD", "PAUSED"]);
  } else if (status === "PAUSED") {
    await client
      .from("campaign_jobs")
      .update({ status: "PAUSED" })
      .eq("campaign_id", id)
      .eq("status", "QUEUED");
  } else {
    await client
      .from("campaign_jobs")
      .update({ status: "CANCELLED" })
      .eq("campaign_id", id)
      .in("status", ["QUEUED", "PAUSED", "HELD"]);
  }
  await logSystem({
    tenant_id: ctx.tenantId,
    customer_id: ctx.customerId,
    action: `CAMPAIGN_${action}`,
    resource: campaign.name,
  });
  return { status };
}

/* --------------------------------- analytics -------------------------------------- */

export async function analytics(ctx: AuthContext) {
  const client = db();
  const t = ctx.tenantId;
  const [
    { data: campaigns },
    { data: groups },
    { data: contacts },
    { data: jobStats },
    totalUsers,
    eligibleUsers,
    active30,
    activePosters,
    inactive,
    unknownPresence,
    connectedSessions,
  ] = await Promise.all([
    client
      .from("campaigns")
      .select("created_at, status, type")
      .eq("tenant_id", t),
    client
      .from("discovered_groups")
      .select("status, discovered_at, can_send_messages, writable_status, sendable_status")
      .eq("tenant_id", t),
    client
      .from("audience_contacts")
      .select("contact_count, first_found_at, last_contacted_at, presence_status, messages_observed, recent_activity_at")
      .eq("tenant_id", t),
    client
      .from("campaign_job_stats")
      .select("campaign_type, campaign_status, total_messages, sent_messages, pending_messages, failed_messages")
      .eq("tenant_id", t),
    client.from("audience_contacts").select("id", { count: "exact", head: true }).eq("tenant_id", t),
    client
      .from("audience_contacts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", t)
      .eq("eligibility", "OPTED_IN"),
    client
      .from("audience_contacts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", t)
      .eq("eligibility", "OPTED_IN")
      .or(
        `presence_status.in.(${ACTIVE_PRESENCE.join(",")}),recent_activity_at.gte.${new Date(Date.now() - 30 * 86_400_000).toISOString()}`,
      ),
    client
      .from("audience_contacts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", t)
      .gt("messages_observed", 0),
    client
      .from("audience_contacts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", t)
      .eq("presence_status", "LONG_AGO"),
    client
      .from("audience_contacts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", t)
      .or("presence_status.is.null,presence_status.eq.UNKNOWN"),
    client
      .from("telegram_connections")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", t)
      .eq("status", "CONNECTED"),
  ]);

  const days = [...Array(14)].map((_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400_000);
    return d.toISOString().slice(0, 10);
  });
  const byDay = (rows: { at: string | null }[]) =>
    days.map((day) => ({
      day: day.slice(5),
      value: rows.filter((r) => r.at?.slice(0, 10) === day).length,
    }));

  const jobRows = (jobStats ?? []) as (CampaignJobStats & {
    campaign_type?: string | null;
    campaign_status?: string | null;
  })[];
  const allMessages = sumJobStats(jobRows);
  const dmMessages = sumJobStats(jobRows.filter((row) => row.campaign_type === "DM"));
  const groupMessages = sumJobStats(jobRows.filter((row) => row.campaign_type === "GROUP"));
  const dmCampaigns = (campaigns ?? []).filter((c) => c.type === "DM");
  const groupCampaigns = (campaigns ?? []).filter((c) => c.type === "GROUP");
  const successRate = (stats: CampaignJobStats) =>
    stats.sent_messages + stats.failed_messages
      ? Math.round((stats.sent_messages / (stats.sent_messages + stats.failed_messages)) * 100)
      : 0;
  const campaignStatus = {
    active: (campaigns ?? []).filter((c) => ["RUNNING", "SCHEDULED"].includes(String(c.status))).length,
    paused: (campaigns ?? []).filter((c) => String(c.status) === "PAUSED").length,
    completed: (campaigns ?? []).filter((c) => String(c.status).startsWith("COMPLETED")).length,
  };

  return {
    totals: {
      totalUsers: totalUsers.count ?? 0,
      totalGroups: groups?.length ?? 0,
      approvedGroups: groups?.filter((g) => g.status === "APPROVED").length ?? 0,
      writableGroups:
        groups?.filter((g) => g.can_send_messages === true && g.writable_status === "WRITABLE")
          .length ?? 0,
      sendableGroups: groups?.filter((g) => g.sendable_status === "SENDABLE").length ?? 0,
      totalCampaigns: campaigns?.length ?? 0,
      messagesSent: allMessages.sent_messages,
      failed: allMessages.failed_messages,
      pending: allMessages.pending_messages,
    },
    campaignOverview: allMessages,
    campaignStatus,
    dmPromotion: {
      totalCampaigns: dmCampaigns.length,
      active: dmCampaigns.filter((c) => ["RUNNING", "SCHEDULED"].includes(String(c.status))).length,
      completed: dmCampaigns.filter((c) => String(c.status).startsWith("COMPLETED")).length,
      messagesSent: dmMessages.sent_messages,
      failed: dmMessages.failed_messages,
      pending: dmMessages.pending_messages,
      successRate: successRate(dmMessages),
    },
    groupPromotion: {
      totalCampaigns: groupCampaigns.length,
      active: groupCampaigns.filter((c) => ["RUNNING", "SCHEDULED"].includes(String(c.status))).length,
      completed: groupCampaigns.filter((c) => String(c.status).startsWith("COMPLETED")).length,
      messagesSent: groupMessages.sent_messages,
      failed: groupMessages.failed_messages,
      pending: groupMessages.pending_messages,
      successRate: successRate(groupMessages),
    },
    users: {
      totalDiscovered: totalUsers.count ?? 0,
      eligible: eligibleUsers.count ?? 0,
      active30: active30.count ?? 0,
      activePosters: activePosters.count ?? 0,
      inactive: inactive.count ?? 0,
      unknownPresence: unknownPresence.count ?? 0,
      connectedSessions: connectedSessions.count ?? 0,
    },
    groups: {
      discovered: groups?.length ?? 0,
      approved: groups?.filter((g) => g.status === "APPROVED").length ?? 0,
      writable:
        groups?.filter((g) => g.can_send_messages === true && g.writable_status === "WRITABLE")
          .length ?? 0,
      sendable: groups?.filter((g) => g.sendable_status === "SENDABLE").length ?? 0,
      notWritable: groups?.filter((g) => g.writable_status === "NOT_WRITABLE").length ?? 0,
      joined: groups?.filter((g) => g.status === "JOINED").length ?? 0,
    },
    charts: {
      campaigns: byDay((campaigns ?? []).map((c) => ({ at: c.created_at as string }))),
      groups: byDay((groups ?? []).map((g) => ({ at: g.discovered_at as string }))),
      audience: byDay((contacts ?? []).map((c) => ({ at: c.first_found_at as string }))),
    },
  };
}

/* ------------------------------ billing / settings -------------------------------- */

export async function billing(ctx: AuthContext) {
  const client = db();
  await ensureDefaultPlans();
  const [tenant, plans, { data: subscription }, { data: transactions }, { data: invoices }, payments, usage, active, premiumEmoji, premiumEmojiProduct] =
    await Promise.all([
      tenantOverview(ctx),
      officialPlans(),
      client
        .from("subscriptions")
        .select("*, plans(*)")
        .eq("tenant_id", ctx.tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      client
        .from("billing_transactions")
        .select("*, plans(name)")
        .eq("tenant_id", ctx.tenantId)
        .order("created_at", { ascending: false })
        .limit(50),
      client
        .from("billing_invoices")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .order("created_at", { ascending: false })
        .limit(50),
      getSetting<{ payment_enabled?: boolean; network?: string; wallet_address?: string }>(
        "payments",
      ),
      tenantUsageDashboard(ctx.tenantId),
      activeInvoice(ctx.tenantId),
      premiumEmojiEntitlement(ctx.tenantId),
      premiumEmojiSettings(),
    ]);
  const currentCode = String(usage.plan?.code ?? tenant?.plans?.code ?? "TEST").toUpperCase();
  const currentRank = usage.expired ? (PLAN_RANK.TEST ?? 0) : (PLAN_RANK[currentCode] ?? PLAN_RANK.TEST ?? 0);
  const upgradePlans = (plans ?? []).filter((plan: Record<string, unknown>) => {
    const code = String(plan["code"] ?? "").toUpperCase();
    return (PLAN_RANK[code] ?? -1) > currentRank;
  });
  return {
    tenant,
    plans: upgradePlans,
    officialPlans: plans ?? [],
    subscription,
    transactions: transactions ?? [],
    invoices: invoices ?? [],
    activeInvoice: active,
    usage,
    addons: {
      premiumEmoji: {
        ...premiumEmojiProduct,
        code: PREMIUM_EMOJI_CODE,
        name: "Premium Emoji",
        active: premiumEmoji.active,
        entitlement: premiumEmoji.entitlement,
      },
    },
    payments: {
      enabled: !!payments.payment_enabled && !!payments.wallet_address,
      network: payments.network ?? "TRC20",
      wallet: payments.payment_enabled ? (payments.wallet_address ?? "") : "",
    },
  };
}

export async function requestPayment(ctx: AuthContext, input: string | { planId: string; replace?: boolean }) {
  const client = db();
  const planId = typeof input === "string" ? input : input.planId;
  const { data: plan } = await client
    .from("plans")
    .select("*")
    .eq("id", planId)
    .eq("is_active", true)
    .eq("is_public", true)
    .maybeSingle();
  if (!plan) throw new Error("Plan not found.");
  const current = await tenantUsageDashboard(ctx.tenantId);
  const currentCode = String(current.plan?.code ?? "TEST").toUpperCase();
  const currentRank = current.expired ? (PLAN_RANK.TEST ?? 0) : (PLAN_RANK[currentCode] ?? PLAN_RANK.TEST ?? 0);
  const targetCode = String(plan.code ?? "").toUpperCase();
  if ((PLAN_RANK[targetCode] ?? -1) <= currentRank) {
    throw new Error("This plan is not available as an upgrade from your current plan.");
  }
  if (Number(plan.price_usd ?? 0) <= 0) {
    const expires = Number(plan.duration_days ?? 0) > 0
      ? new Date(Date.now() + Number(plan.duration_days) * 86400_000).toISOString()
      : null;
    await client
      .from("tenants")
      .update({ plan_id: plan.id, plan_expires_at: expires, updated_at: new Date().toISOString() })
      .eq("id", ctx.tenantId);
    await client.from("subscriptions").insert({
      tenant_id: ctx.tenantId,
      plan_id: plan.id,
      status: "ACTIVE",
      payment_status: "NONE",
      expires_at: expires,
      no_expiry: expires === null,
      metadata: { self_selected_free_plan: true },
    });
    await client.from("tenant_entitlement_overrides").delete().eq("tenant_id", ctx.tenantId);
    await notify(ctx.tenantId, "Plan updated", `Your ${plan.name} plan is active.`, "SUCCESS", "/mini-app/billing");
    return { status: "ACTIVE", free: true, plan_id: plan.id };
  }
  return createInvoice({
    tenantId: ctx.tenantId,
    productType: "PLAN",
    productCode: targetCode,
    planId,
    basePrice: Number(plan.price_usd),
    replace: typeof input === "object" ? input.replace : false,
  });
}

export async function requestPremiumEmojiPayment(ctx: AuthContext, input: { replace?: boolean } = {}) {
  const entitlement = await premiumEmojiEntitlement(ctx.tenantId);
  if (entitlement.active) throw new Error("Premium Emoji is already active.");
  const settings = await premiumEmojiSettings();
  if (!settings.enabled) throw new Error("Premium Emoji add-on is not available.");
  return createInvoice({
    tenantId: ctx.tenantId,
    productType: "ADDON",
    productCode: PREMIUM_EMOJI_CODE,
    basePrice: settings.price_usd,
    replace: input.replace,
  });
}

export async function getInvoiceStatus(ctx: AuthContext, invoiceId: string) {
  return invoiceByIdForTenant(ctx.tenantId, invoiceId);
}

const invoiceCheckCooldown = new Map<string, number>();

export async function checkInvoicePaymentStatus(ctx: AuthContext, invoiceId: string) {
  await invoiceByIdForTenant(ctx.tenantId, invoiceId);
  const key = `${ctx.tenantId}:${invoiceId}`;
  const last = invoiceCheckCooldown.get(key) ?? 0;
  if (Date.now() - last < 10_000) {
    return invoiceByIdForTenant(ctx.tenantId, invoiceId);
  }
  invoiceCheckCooldown.set(key, Date.now());
  await reconcileInvoicePayment(invoiceId);
  return invoiceByIdForTenant(ctx.tenantId, invoiceId);
}

export function normalizeSupportTelegram(value?: string | null) {
  const raw = String(value ?? "").trim().replace(/^https?:\/\/t\.me\//i, "").replace(/^@/, "");
  if (!raw) return "";
  return /^[A-Za-z0-9_]{5,32}$/.test(raw) ? raw : "";
}

export async function supportSettings() {
  const general = await getSetting<{ support_telegram?: string; support_email?: string }>("general");
  const telegramUsername = normalizeSupportTelegram(general.support_telegram);
  return {
    telegramUsername,
    telegramUrl: telegramUsername ? `https://t.me/${telegramUsername}` : "",
    email: String(general.support_email ?? "").trim(),
  };
}

function sessionLevelPreviewFailure(error: unknown) {
  const message = (error instanceof Error ? error.message : String(error)).toUpperCase();
  return message.includes("AUTH_KEY_UNREGISTERED") ||
    message.includes("SESSION") ||
    message.includes("TIMEOUT") ||
    message.includes("NETWORK") ||
    message.includes("ECONN") ||
    message.includes("COOLING DOWN");
}

async function validateSendingSessionForCustomEmoji(
  ctx: AuthContext,
  connection: Record<string, unknown>,
  message: { entities?: { type?: string; premium_required?: boolean }[] },
) {
  const needsPremium = (message.entities ?? []).some((entity) => entity.type === "custom_emoji" && entity.premium_required === true);
  if (!needsPremium) return;
  const checkedAt = connection.telegram_premium_checked_at ? new Date(String(connection.telegram_premium_checked_at)).getTime() : 0;
  const stale = !checkedAt || Date.now() - checkedAt > 24 * 60 * 60 * 1000;
  let current = connection;
  if (stale && connection.id) {
    const refreshed = await checkUserSession(ctx, String(connection.id));
    if (refreshed.ok) current = refreshed.connection as unknown as Record<string, unknown>;
  }
  if (current.telegram_premium !== true) {
    throw new Error("This linked Telegram account requires Telegram Premium to send this custom emoji.");
  }
}

async function premiumEmojiPreviewCandidates(ctx: AuthContext, requestedConnectionId?: string | null) {
  const client = db();
  const [{ data: preferences }, { data: rows }] = await Promise.all([
    client
      .from("customer_preferences")
      .select("premium_emoji_session_mode, preferred_premium_emoji_connection_id")
      .eq("tenant_id", ctx.tenantId)
      .eq("customer_id", ctx.customerId)
      .maybeSingle(),
    client
      .from("telegram_connections")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .not("encrypted_session", "is", null),
  ]);
  const connections = (rows ?? []).filter((row) => sessionUsable(row as Record<string, unknown>));
  const byId = new Map(connections.map((row) => [String(row.id), row]));
  const ordered: string[] = [];
  const add = (id?: string | null) => {
    if (id && byId.has(id) && !ordered.includes(id)) ordered.push(id);
  };
  if (preferences?.premium_emoji_session_mode === "MANUAL") {
    const preferred = byId.get(String(preferences.preferred_premium_emoji_connection_id ?? ""));
    if (preferred && (preferred as { telegram_premium?: boolean | null }).telegram_premium === true) add(String(preferred.id));
  }
  const requested = requestedConnectionId ? byId.get(requestedConnectionId) : null;
  if (requested && (requested as { telegram_premium?: boolean | null }).telegram_premium === true) add(requestedConnectionId);
  connections
    .filter((row) => (row as { telegram_premium?: boolean | null }).telegram_premium === true)
    .sort((a, b) => Number(b.health_score ?? 0) - Number(a.health_score ?? 0))
    .forEach((row) => add(String(row.id)));
  if (requested) add(requestedConnectionId);
  connections
    .sort((a, b) => Number(b.health_score ?? 0) - Number(a.health_score ?? 0))
    .forEach((row) => add(String(row.id)));
  if (!ordered.length) throw new Error("Connect a healthy Telegram session first.");
  return ordered;
}

export async function customEmojiCatalog(ctx: AuthContext, input: { connectionId?: string | null; query?: string | null; tab?: string | null }) {
  const entitlement = await premiumEmojiEntitlement(ctx.tenantId);
  if (!entitlement.active) throw new Error("Premium Emoji add-on is required.");
  const candidates = await premiumEmojiPreviewCandidates(ctx, input.connectionId ?? null);
  let lastError: unknown = null;
  for (const connectionId of candidates) {
    try {
      return await listCustomEmojiCatalogViaUserSession(ctx.tenantId, connectionId, {
        query: input.query ?? null,
        tab: input.tab ?? null,
      });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn("CUSTOM_EMOJI_PREVIEW_SESSION_FAILED", { tenant_id: ctx.tenantId, connection_id: connectionId, error: message });
      if (!sessionLevelPreviewFailure(error)) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Custom emoji could not be loaded.");
}

export async function customEmojiPreview(ctx: AuthContext, input: { connectionId?: string | null; documentId: string }) {
  const entitlement = await premiumEmojiEntitlement(ctx.tenantId);
  if (!entitlement.active) throw new Error("Premium Emoji add-on is required.");
  const candidates = await premiumEmojiPreviewCandidates(ctx, input.connectionId ?? null);
  let lastError: unknown = null;
  for (const connectionId of candidates) {
    try {
      const result = await customEmojiPreviewViaUserSession(ctx.tenantId, connectionId, input.documentId);
      return { ...result, preview_connection_id: connectionId };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn("CUSTOM_EMOJI_PREVIEW_SESSION_FAILED", { tenant_id: ctx.tenantId, connection_id: connectionId, document_id: input.documentId, error: message });
      if (!sessionLevelPreviewFailure(error)) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Telegram custom emoji preview could not be downloaded.");
}

export async function customEmojiPreviews(ctx: AuthContext, input: { connectionId?: string | null; documentIds: string[] }) {
  const entitlement = await premiumEmojiEntitlement(ctx.tenantId);
  if (!entitlement.active) throw new Error("Premium Emoji add-on is required.");
  const candidates = await premiumEmojiPreviewCandidates(ctx, input.connectionId ?? null);
  let lastError: unknown = null;
  for (const connectionId of candidates) {
    try {
      const result = await customEmojiPreviewsViaUserSession(ctx.tenantId, connectionId, input.documentIds);
      return { ...result, preview_connection_id: connectionId };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.warn("CUSTOM_EMOJI_PREVIEW_SESSION_FAILED", { tenant_id: ctx.tenantId, connection_id: connectionId, error: message });
      if (!sessionLevelPreviewFailure(error)) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Telegram custom emoji previews could not be downloaded.");
}

export async function listNotifications(ctx: AuthContext) {
  const { data } = await db()
    .from("notifications")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function markNotificationsRead(ctx: AuthContext) {
  await db()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("tenant_id", ctx.tenantId)
    .is("read_at", null);
}

export async function ownActivity(ctx: AuthContext) {
  const { data } = await db()
    .from("system_logs")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}
