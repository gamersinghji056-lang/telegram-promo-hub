import { db, getSetting, logSystem, notify } from "./db.server";
import type { AuthContext } from "./customer-auth.server";
import { callBot, botToken } from "./telegram.server";
import { createHash, randomBytes } from "node:crypto";
import {
  checkUserSession,
  completeUserSessionCode,
  completeUserSessionPassword,
  disconnectUserSession,
  discoverAudienceViaUserSession,
  importGroupsFromFolderViaUserSession,
  joinGroupViaUserSession,
  resolvePublicGroupViaUserSession,
  searchPublicGroupsViaUserSession,
  startUserSessionLogin,
  testGroupWritableViaUserSession,
  verifyGroupWritableViaUserSession,
} from "./telegram-user-session.server";

const MAX_TELEGRAM_SESSIONS = 20;
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
  const { data } = await db()
    .from("telegram_connections")
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .not("encrypted_session", "is", null)
    .not("status", "in", "(DISCONNECTED,AUTH_CODE_SENT,TWO_FACTOR_REQUIRED)")
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(10);
  const now = Date.now();
  const connection = (data ?? []).find((row) => {
    const cooldown = row.cooldown_until ? new Date(row.cooldown_until as string).getTime() : 0;
    return (
      !cooldown || cooldown <= now
    );
  });
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
      messagesUsed: (tenant as { messages_used?: number } | null)?.messages_used ?? 0,
      messageLimit: Number(plan?.["monthly_message_limit"] ?? 0),
      groupsUsed: groupsApproved + groupsJoined,
      groupsLimit: Number(plan?.["max_groups"] ?? 0),
      connectionsUsed: connections,
      connectionsLimit: Number(plan?.["max_connections"] ?? 0),
    },
    subscription: {
      planName: String(plan?.["name"] ?? "No plan"),
      price: Number(plan?.["price_usd"] ?? 0),
      expiresAt: (tenant as { plan_expires_at?: string } | null)?.plan_expires_at ?? null,
      status: (tenant as { status?: string } | null)?.status ?? "ACTIVE",
    },
    unreadNotifications: unread,
    account: { email: ctx.email, name: ctx.name },
  };
}

/* -------------------------------- connections ------------------------------------ */

export async function listConnections(ctx: AuthContext) {
  const { data } = await db()
    .from("telegram_connections")
    .select(
      "id, tenant_id, label, account_name, username, telegram_id, telegram_user_id, phone_masked, status, health, error_message, restriction_status, restriction_reason, last_active_at, last_used_at, last_sync_at, link_expires_at, cooldown_until, auth_step, encrypted_session, created_at, updated_at",
    )
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(({ encrypted_session, ...row }) => ({
    ...row,
    has_session: Boolean(encrypted_session),
  }));
}

export async function createConnection(ctx: AuthContext, label: string) {
  throw new Error("Use ADD SESSION with phone verification inside the Mini App.");
}

export async function checkConnection(ctx: AuthContext, connectionId: string) {
  return checkUserSession(ctx, connectionId);
}

export async function startConnectionLogin(
  ctx: AuthContext,
  input: { label: string; phone: string },
) {
  return startUserSessionLogin(ctx, input);
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
        writable_status: group.canSendMessages === false ? "NOT_WRITABLE" : "WRITABLE",
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

  const tenant = await tenantOverview(ctx);
  const limit = Number(
    (tenant as { plans?: Record<string, number> } | null)?.plans?.["max_groups"] ?? 0,
  );
  const { count } = await client
    .from("discovered_groups")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId)
    .in("status", ["APPROVED", "JOINED"]);
  if (limit && (count ?? 0) >= limit) throw new Error(`Your plan allows ${limit} active group(s).`);

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
    let index = Number(state.current_index ?? 0);
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

type AudienceQueryOptions = {
  groupIds?: string[];
  onlyNew?: boolean;
  filter?: AudienceFilter;
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
    excludeInactive: options.excludeInactive ?? true,
    page: Math.max(1, Number(options.page ?? 1)),
    pageSize: Math.max(25, Math.min(100, Number(options.pageSize ?? 100))),
  };
}

function applyAudienceFilters(query: any, options: Required<AudienceQueryOptions>) {
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
  if (options.excludeInactive) {
    q = q.neq("presence_status", "LONG_AGO");
  }
  return q;
}

function orderAudience(query: any) {
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
  return { ids: (data ?? []).map((row) => row.id as string) };
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
    .select("category_id, group_id, discovered_groups(can_send_messages, writable_status)")
    .eq("tenant_id", ctx.tenantId)
    .in(
      "category_id",
      categories.map((c) => c.id),
    );
  const counts = new Map<string, number>();
  const usableCounts = new Map<string, number>();
  for (const member of members ?? []) {
    const categoryId = member.category_id as string;
    counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
    const group = Array.isArray(member.discovered_groups)
      ? member.discovered_groups[0]
      : member.discovered_groups;
    if (group?.can_send_messages === true && group?.writable_status === "WRITABLE") {
      usableCounts.set(categoryId, (usableCounts.get(categoryId) ?? 0) + 1);
    }
  }
  return categories.map((category) => ({
    ...category,
    group_count: counts.get(category.id as string) ?? 0,
    usable_count: usableCounts.get(category.id as string) ?? 0,
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
  return {
    category,
    groups,
    usable_count: usableCount,
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
  const [total, writable, notWritable, unknown] = await Promise.all([
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
    notWritable: notWritable.count ?? 0,
    unknown: unknown.count ?? 0,
  };
}

export async function verifyWritableGroups(ctx: AuthContext, limit = 40) {
  const client = db();
  const proofCount = await applySuccessfulSendWritableProof(ctx);
  const { data: unknownGroups } = await client
    .from("discovered_groups")
    .select("id, title, username, telegram_group_id, access_hash, entity_type")
    .eq("tenant_id", ctx.tenantId)
    .in("status", ["APPROVED", "JOINED"])
    .or("writable_status.is.null,writable_status.eq.UNKNOWN,can_send_messages.is.null")
    .order("updated_at", { ascending: true, nullsFirst: true })
    .limit(Math.max(1, Math.min(100, Number(limit) || 40)));
  const rows = unknownGroups ?? [];
  const result = {
    checked: 0,
    total: rows.length,
    writable: proofCount,
    notWritable: 0,
    unknown: 0,
    errors: [] as { group: string; reason: string }[],
  };
  if (!rows.length) return { ...result, summary: await groupWritabilitySummary(ctx) };
  const connection = await defaultHealthyConnection(ctx);
  for (const group of rows) {
    result.checked += 1;
    try {
      const verified = await verifyGroupWritableViaUserSession(ctx.tenantId, connection.id as string, {
        username: group.username as string | null,
        telegram_group_id: group.telegram_group_id as number | null,
        access_hash: group.access_hash as string | null,
        entity_type: group.entity_type as string | null,
      });
      const writable = verified.writableStatus === "WRITABLE";
      const notWritable = verified.writableStatus === "NOT_WRITABLE";
      await client
        .from("discovered_groups")
        .update({
          title: verified.title ?? group.title,
          username: verified.username ?? group.username,
          telegram_group_id: verified.telegramGroupId ?? group.telegram_group_id,
          access_hash: verified.accessHash ?? group.access_hash,
          entity_type: verified.entityType ?? group.entity_type,
          can_send_messages: writable ? true : notWritable ? false : null,
          writable_status: verified.writableStatus,
          last_resolved_connection_id: connection.id,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", ctx.tenantId)
        .eq("id", group.id);
      if (writable) result.writable += 1;
      else if (notWritable) result.notWritable += 1;
      else result.unknown += 1;
    } catch (error) {
      result.unknown += 1;
      result.errors.push({
        group: String(group.title ?? group.username ?? group.id),
        reason: error instanceof Error ? error.message : "Verification failed.",
      });
    }
  }
  await clientConnectionUsed(ctx.tenantId, connection.id as string);
  await notify(
    ctx.tenantId,
    "Group verification completed",
    `Checked ${result.checked} group(s). Writable: ${result.writable}. Not writable: ${result.notWritable}. Unknown: ${result.unknown}.`,
    "INFO",
    "/mini-app/group-categories",
  );
  return { ...result, summary: await groupWritabilitySummary(ctx) };
}

export async function testWritableGroups(
  ctx: AuthContext,
  input: { connectionId: string; groupIds: string[] },
) {
  const connection = await requireConnection(ctx, input.connectionId);
  const ids = [...new Set(input.groupIds)].slice(0, 100);
  if (!ids.length) throw new Error("Select at least one group to test.");
  const client = db();
  const { data: rows, error } = await client
    .from("discovered_groups")
    .select("id, title, username, telegram_group_id, access_hash, entity_type, writable_status")
    .eq("tenant_id", ctx.tenantId)
    .in("status", ["APPROVED", "JOINED"])
    .in("id", ids);
  if (error) throw new Error(error.message);
  const result = {
    checked: 0,
    total: rows?.length ?? 0,
    writable: 0,
    notWritable: 0,
    unknown: 0,
    inaccessible: 0,
    paused: false,
    errors: [] as { group: string; reason: string }[],
  };
  for (const group of rows ?? []) {
    result.checked += 1;
    let tested;
    try {
      tested = await testGroupWritableViaUserSession(ctx.tenantId, connection.id as string, {
        username: group.username as string | null,
        telegram_group_id: group.telegram_group_id as number | null,
        access_hash: group.access_hash as string | null,
        entity_type: group.entity_type as string | null,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Writable test failed.";
      tested = {
        writableStatus: "UNKNOWN",
        canSendMessages: null,
        reason,
      };
    }
    const status = tested.writableStatus;
    const patch: Record<string, unknown> = {
      can_send_messages: status === "WRITABLE" ? true : status === "UNKNOWN" ? null : false,
      writable_status: status,
      last_resolved_connection_id: connection.id,
      updated_at: new Date().toISOString(),
    };
    if ("title" in tested && tested.title) patch.title = tested.title;
    if ("username" in tested && tested.username) patch.username = tested.username;
    if ("telegramGroupId" in tested && tested.telegramGroupId) patch.telegram_group_id = tested.telegramGroupId;
    if ("accessHash" in tested) patch.access_hash = tested.accessHash;
    if ("entityType" in tested && tested.entityType) patch.entity_type = tested.entityType;
    await client
      .from("discovered_groups")
      .update(patch)
      .eq("tenant_id", ctx.tenantId)
      .eq("id", group.id);
    if (status === "WRITABLE") result.writable += 1;
    else if (status === "NOT_WRITABLE") result.notWritable += 1;
    else if (status === "INACCESSIBLE") result.inaccessible += 1;
    else result.unknown += 1;
    if (tested.reason) {
      result.errors.push({
        group: String(group.title ?? group.username ?? group.id),
        reason: tested.reason,
      });
    }
    if ((rows?.length ?? 0) > 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  await clientConnectionUsed(ctx.tenantId, connection.id as string);
  if (ids.length > 1) {
    await notify(
      ctx.tenantId,
      "Writable group test completed",
      `Tested ${result.checked}/${result.total}. Writable: ${result.writable}. Not writable: ${result.notWritable}. Unknown: ${result.unknown}. Inaccessible: ${result.inaccessible}.`,
      "INFO",
      "/mini-app/groups-approved",
    );
  }
  return { ...result, summary: await groupWritabilitySummary(ctx) };
}

export async function saveGroupCategory(
  ctx: AuthContext,
  input: { id?: string | null; name: string; group_ids: string[] },
) {
  const client = db();
  const name = input.name.trim();
  if (!name) throw new Error("Category name is required.");
  const ids = [...new Set(input.group_ids)];
  if (!ids.length) throw new Error("Select at least one approved group.");
  const { data: groups } = await client
    .from("discovered_groups")
    .select("id, can_send_messages, writable_status, entity_type")
    .eq("tenant_id", ctx.tenantId)
    .in("id", ids)
    .in("status", ["APPROVED", "JOINED"])
    .eq("can_send_messages", true)
    .eq("writable_status", "WRITABLE");
  if ((groups ?? []).length !== ids.length) {
    throw new Error("One or more selected groups are not confirmed writable.");
  }

  let categoryId = input.id ?? null;
  if (categoryId) {
    const { error } = await client
      .from("group_categories")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", categoryId)
      .eq("tenant_id", ctx.tenantId);
    if (error) throw new Error(error.message);
  } else {
    const { data: category, error } = await client
      .from("group_categories")
      .insert({ tenant_id: ctx.tenantId, name })
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
    ids.map((groupId) => ({
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
  return {
    campaign: withCampaignJobStats(campaign, stats.get(id)),
    groups: groups ?? [],
    recipients: recipients ?? [],
    logs: logs ?? [],
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
      media_type?: string | null;
      media_url?: string | null;
      buttons?: { text: string; url: string }[];
    };
    group_ids: string[];
    group_category_id?: string | null;
    contact_ids: string[];
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
  let categoryGroupCount = 0;
  let categoryUnavailableCount = 0;
  if (input.group_category_id) {
    const { data: category } = await client
      .from("group_categories")
      .select("id")
      .eq("id", input.group_category_id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();
    if (!category) throw new Error("Selected group category was not found.");
    const { data: members } = await client
      .from("group_category_members")
      .select("group_id")
      .eq("tenant_id", ctx.tenantId)
      .eq("category_id", input.group_category_id);
    groupIds = [...new Set((members ?? []).map((m) => m.group_id as string))];
    categoryGroupCount = groupIds.length;
  }
  const minDelay = Math.max(1, Number(input.min_delay_seconds ?? 30));
  const maxDelay = Math.max(1, Number(input.max_delay_seconds ?? 60));
  if (minDelay > maxDelay) throw new Error("Minimum delay must be less than or equal to maximum delay.");
  const cycleDelay = Math.max(1, Number(input.cycle_delay_minutes ?? 20));
  if (!input.name.trim()) throw new Error("Give the campaign a name.");
  if (!input.message.text && !input.message.media_url)
    throw new Error("The message cannot be empty.");
  if (input.type !== "DM" && groupIds.length === 0)
    throw new Error("Select at least one group.");
  if (input.type !== "GROUP" && input.contact_ids.length === 0)
    throw new Error("Select at least one recipient.");
  const connection = await requireConnection(ctx, input.connection_id);

  let writableGroups: { id: string }[] = [];
  if (input.type === "GROUP" && groupIds.length) {
    const { data: groups } = await client
      .from("discovered_groups")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .in("id", groupIds)
      .in("status", ["APPROVED", "JOINED"])
      .eq("can_send_messages", true)
      .eq("writable_status", "WRITABLE");
    writableGroups = ((groups ?? []) as { id: string }[]);
    groupIds = writableGroups.map((g) => g.id);
    categoryUnavailableCount = Math.max(categoryGroupCount - groupIds.length, 0);
    if (!groupIds.length) {
      throw new Error(
        "Selected category has no confirmed writable groups. Run TEST WRITABLE GROUPS with a connected session.",
      );
    }
  }

  const tenant = await tenantOverview(ctx);
  const plan = (tenant as { plans?: Record<string, number> } | null)?.plans ?? {};
  const messagesUsed = (tenant as { messages_used?: number } | null)?.messages_used ?? 0;
  const limit = Number(plan["monthly_message_limit"] ?? 0);
  const targetCount = groupIds.length + input.contact_ids.length;
  if (limit && messagesUsed + targetCount > limit)
    throw new Error(`This campaign exceeds your monthly message limit (${limit}).`);

  const status = input.start_now
    ? "RUNNING"
    : input.scheduled_at
      ? "SCHEDULED"
      : "PENDING_APPROVAL";

  const { data: campaign, error } = await client
    .from("campaigns")
    .insert({
      tenant_id: ctx.tenantId,
      name: input.name.trim(),
      type: input.type,
      status,
      connection_id: input.connection_id ?? null,
      template_id: input.template_id ?? null,
      message: input.message,
      group_category_id: input.group_category_id ?? null,
      min_delay_seconds: minDelay,
      max_delay_seconds: maxDelay,
      cycle_delay_minutes: cycleDelay,
      scheduled_at: input.scheduled_at ?? null,
      started_at: input.start_now ? new Date().toISOString() : null,
      total_targets: targetCount,
    })
    .select("*")
    .single();
  if (error || !campaign) throw new Error(error?.message ?? "Could not create the campaign.");

  if (groupIds.length) {
    const rows = writableGroups.map((g) => ({
      campaign_id: campaign.id,
      tenant_id: ctx.tenantId,
      group_id: g.id,
      status: "PENDING",
    }));
    if (rows.length)
      await client.from("campaign_groups").upsert(rows, { onConflict: "campaign_id,group_id" });
  }

  if (input.contact_ids.length) {
    let contactQuery = client
      .from("audience_contacts")
      .select("id, telegram_user_id")
      .eq("tenant_id", ctx.tenantId)
      .in("id", input.contact_ids)
      .eq("eligibility", "OPTED_IN");
    if (input.exclude_previously_contacted !== false)
      contactQuery = contactQuery.eq("contact_count", 0);
    const { data: contacts } = await contactQuery;
    // Dedupe by telegram user id so a user in several groups is contacted once.
    const unique = new Map<number, { id: string; telegram_user_id: number }>();
    for (const c of contacts ?? []) unique.set(c.telegram_user_id as number, c as never);
    if (unique.size === 0) {
      await client.from("campaigns").delete().eq("id", campaign.id).eq("tenant_id", ctx.tenantId);
      throw new Error("No selected recipients are eligible for DM promotion.");
    }
    const rows = [...unique.values()].map((c) => ({
      campaign_id: campaign.id,
      tenant_id: ctx.tenantId,
      contact_id: c.id,
      telegram_user_id: c.telegram_user_id,
      status: "PENDING",
    }));
    if (rows.length)
      await client
        .from("campaign_recipients")
        .upsert(rows, { onConflict: "campaign_id,telegram_user_id" });
  }

  await enqueueCampaignJobs(campaign.id as string, ctx.tenantId, input.start_now);

  const groupCount =
    (
      await client
        .from("campaign_groups")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
    ).count ?? 0;
  const recipientCount =
    (
      await client
        .from("campaign_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
    ).count ?? 0;
  await client
    .from("campaigns")
    .update({ total_targets: groupCount + recipientCount })
    .eq("id", campaign.id);
  await client.from("campaign_logs").insert({
    tenant_id: ctx.tenantId,
    campaign_id: campaign.id,
    level: "INFO",
    message: "Campaign approved and jobs created.",
    details: {
      groups: groupCount,
      recipients: recipientCount,
      connection_id: connection.id,
      category_groups: categoryGroupCount || groupCount,
      unavailable_groups: categoryUnavailableCount,
    },
  });
  await clientConnectionUsed(ctx.tenantId, connection.id as string);

  await logSystem({
    tenant_id: ctx.tenantId,
    customer_id: ctx.customerId,
    action: "CAMPAIGN_CREATED",
    resource: campaign.name,
  });
  await notify(ctx.tenantId, "Campaign created", `${campaign.name} is ${status.toLowerCase()}.`);
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
  if (input.connection_id) await requireConnection(ctx, input.connection_id);
  const { data, error } = await db()
    .from("campaigns")
    .update({
      name: input.name.trim(),
      connection_id: input.connection_id ?? null,
      group_category_id: input.group_category_id ?? null,
      message: input.message,
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
      .select("status, discovered_at, can_send_messages, writable_status")
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
  const [tenant, { data: plans }, { data: subscription }, { data: transactions }, payments] =
    await Promise.all([
      tenantOverview(ctx),
      client.from("plans").select("*").eq("is_active", true).order("sort_order"),
      client
        .from("subscriptions")
        .select("*, plans(name, price_usd)")
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
      getSetting<{ payment_enabled?: boolean; network?: string; wallet_address?: string }>(
        "payments",
      ),
    ]);
  return {
    tenant,
    plans: plans ?? [],
    subscription,
    transactions: transactions ?? [],
    payments: {
      enabled: !!payments.payment_enabled && !!payments.wallet_address,
      network: payments.network ?? "TRC20",
      wallet: payments.payment_enabled ? (payments.wallet_address ?? "") : "",
    },
  };
}

export async function requestPayment(ctx: AuthContext, planId: string) {
  const payments = await getSetting<{
    payment_enabled?: boolean;
    network?: string;
    wallet_address?: string;
  }>("payments");
  if (!payments.payment_enabled || !payments.wallet_address)
    throw new Error("Payments are not configured yet. Contact support to upgrade.");
  const client = db();
  const { data: plan } = await client.from("plans").select("*").eq("id", planId).maybeSingle();
  if (!plan) throw new Error("Plan not found.");
  const { data, error } = await client
    .from("billing_transactions")
    .insert({
      tenant_id: ctx.tenantId,
      plan_id: planId,
      amount: plan.price_usd,
      currency: "USDT",
      network: payments.network ?? "TRC20",
      wallet_address: payments.wallet_address,
      status: "PENDING",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
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
