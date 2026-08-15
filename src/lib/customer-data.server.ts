import { db, getSetting, logSystem, notify } from "./db.server";
import type { AuthContext } from "./customer-auth.server";
import { callBot, botToken } from "./telegram.server";
import { createHash, randomBytes } from "node:crypto";
import {
  checkUserSession,
  completeUserSessionCode,
  completeUserSessionPassword,
  disconnectUserSession,
  importGroupsFromFolderViaUserSession,
  joinGroupViaUserSession,
  resolvePublicGroupViaUserSession,
  searchPublicGroupsViaUserSession,
  startUserSessionLogin,
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
  if (connection.status !== "CONNECTED") throw new Error("Select a connected Telegram session.");
  if (connection.cooldown_until && new Date(connection.cooldown_until as string) > new Date()) {
    throw new Error("Selected Telegram session is cooling down.");
  }
  if (["RESTRICTED", "REQUIRES_ACTION"].includes(String(connection.restriction_status ?? ""))) {
    throw new Error("Selected Telegram session requires attention.");
  }
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
      joined: groupsJoined,
    },
    audience: {
      total: audienceTotal,
      contacted: audienceContacted,
      available: Math.max(audienceTotal - audienceContacted, 0),
    },
    campaigns: { running, scheduled, completed, failed, dm: dmCampaigns, group: groupCampaigns },
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
      "id, tenant_id, label, account_name, username, telegram_id, telegram_user_id, phone_masked, status, health, error_message, restriction_status, restriction_reason, last_active_at, last_used_at, last_sync_at, link_expires_at, cooldown_until, auth_step, created_at, updated_at",
    )
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false });
  return data ?? [];
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
    ctx.tenantId,
    connection.id as string,
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
    });
  }

  const rows = [...merged.values()].map((g) => ({
    tenant_id: ctx.tenantId,
    title: g.title,
    username: g.username.replace(/^@/, ""),
    member_count: g.member_count ?? null,
    matched_keywords: [...new Set(g.keywords ?? safeKeywords)],
    status: "FOUND",
    connection_id: connection.id,
    telegram_group_id: g.telegram_group_id ?? null,
  }));
  if (rows.length) {
    const client = db();
    for (const row of rows) {
      const { data: existing } = await client
        .from("discovered_groups")
        .select("id, matched_keywords, status")
        .eq("tenant_id", ctx.tenantId)
        .eq("username", row.username)
        .maybeSingle();
      if (existing) {
        await client
          .from("discovered_groups")
          .update({
            title: row.title,
            member_count: row.member_count,
            telegram_group_id: row.telegram_group_id,
            matched_keywords: [
              ...new Set([...(existing.matched_keywords ?? []), ...row.matched_keywords]),
            ],
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("tenant_id", ctx.tenantId);
      } else {
        await client.from("discovered_groups").insert(row);
      }
    }
  }
  await clientConnectionUsed(ctx.tenantId, connection.id as string);
  await logSystem({
    tenant_id: ctx.tenantId,
    action: "GROUP_DISCOVERY",
    details: { keywords: safeKeywords, found: rows.length },
  });
  return { configured: !!s.provider_url, added: rows.length, results: rows };
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

  const { data, error } = await db()
    .from("discovered_groups")
    .upsert(
      {
        tenant_id: ctx.tenantId,
        title: group.title,
        username: group.username,
        telegram_group_id: group.telegramGroupId,
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
  connectionId: string,
  username: string,
) {
  const row = await addGroupByUsername(ctx, connectionId, username, []);
  await approveGroup(ctx, row.id as string, connectionId);
  return { ...row, status: "APPROVED" };
}

export async function importApprovedGroups(
  ctx: AuthContext,
  connectionId: string,
  folderLink: string,
) {
  const connection = await requireConnection(ctx, connectionId);
  const groups = await importGroupsFromFolderViaUserSession(
    ctx.tenantId,
    connection.id as string,
    folderLink,
  );
  const stats = { imported: 0, duplicates: 0, inaccessible: 0, failed: 0 };
  const client = db();
  for (const group of groups) {
    try {
      const { data: existing } = await client
        .from("discovered_groups")
        .select("id, status")
        .eq("tenant_id", ctx.tenantId)
        .eq("username", group.username)
        .maybeSingle();
      if (existing) {
        stats.duplicates += 1;
        if (!["APPROVED", "JOINED"].includes(String(existing.status))) {
          await client
            .from("discovered_groups")
            .update({ status: "APPROVED", approved_at: new Date().toISOString() })
            .eq("id", existing.id)
            .eq("tenant_id", ctx.tenantId);
        }
        continue;
      }
      await client.from("discovered_groups").insert({
        tenant_id: ctx.tenantId,
        title: group.title,
        username: group.username,
        telegram_group_id: group.telegramGroupId,
        member_count: group.memberCount,
        matched_keywords: [],
        status: "APPROVED",
        approved_at: new Date().toISOString(),
        connection_id: connection.id,
      });
      stats.imported += 1;
    } catch {
      stats.failed += 1;
    }
  }
  await clientConnectionUsed(ctx.tenantId, connection.id as string);
  return stats;
}

export async function listGroups(ctx: AuthContext, status?: string) {
  let q = db().from("discovered_groups").select("*").eq("tenant_id", ctx.tenantId);
  if (status === "APPROVED_ACTIVE") q = q.in("status", ["APPROVED", "JOINED"]);
  else if (status && status !== "ALL") q = q.eq("status", status);
  const { data } = await q.order("discovered_at", { ascending: false });
  return data ?? [];
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

/* --------------------------------- audience --------------------------------------- */

export type AudienceUser = {
  id: string;
  telegram_user_id: number;
  display_name: string | null;
  username: string | null;
  source_group_id: string | null;
  eligibility: string;
  status: string;
  contact_count: number;
  first_found_at: string;
  last_contacted_at: string | null;
};

export async function findAudience(
  ctx: AuthContext,
  groupIds: string[],
  onlyNew: boolean,
): Promise<{
  totalFound: number;
  eligible: number;
  previouslyContacted: number;
  duplicates: number;
  excluded: number;
  users: AudienceUser[];
}> {
  const client = db();
  let q = client
    .from("audience_contacts")
    .select(
      "id, telegram_user_id, display_name, username, source_group_id, eligibility, status, contact_count, first_found_at, last_contacted_at",
    )
    .eq("tenant_id", ctx.tenantId);
  if (groupIds.length) q = q.in("source_group_id", groupIds);
  const { data } = await q.order("first_found_at", { ascending: false }).limit(1000);
  const rows = (data ?? []) as unknown as AudienceUser[];

  // Deduplicate by telegram_user_id (a user in three groups is still one user).
  const seen = new Map<number, AudienceUser>();
  let duplicates = 0;
  for (const row of rows) {
    if (seen.has(row.telegram_user_id)) duplicates += 1;
    else seen.set(row.telegram_user_id, row);
  }
  const unique = [...seen.values()];
  const contacted = unique.filter((u) => u.contact_count > 0);
  const eligible = unique.filter((u) => u.eligibility === "OPTED_IN");
  const excluded = unique.length - eligible.length;
  const visible = onlyNew ? eligible.filter((u) => u.contact_count === 0) : eligible;

  return {
    totalFound: rows.length,
    eligible: eligible.length,
    previouslyContacted: contacted.length,
    duplicates,
    excluded,
    users: visible,
  };
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
    .select("category_id, group_id")
    .eq("tenant_id", ctx.tenantId)
    .in(
      "category_id",
      categories.map((c) => c.id),
    );
  const counts = new Map<string, number>();
  for (const member of members ?? []) {
    counts.set(member.category_id as string, (counts.get(member.category_id as string) ?? 0) + 1);
  }
  return categories.map((category) => ({
    ...category,
    group_count: counts.get(category.id as string) ?? 0,
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
  return { category, groups };
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
    .select("id")
    .eq("tenant_id", ctx.tenantId)
    .in("id", ids)
    .in("status", ["APPROVED", "JOINED"]);
  if ((groups ?? []).length !== ids.length) {
    throw new Error("One or more selected groups are not usable approved groups.");
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
  let q = db()
    .from("campaigns")
    .select("*, group_categories(name)")
    .eq("tenant_id", ctx.tenantId)
    .is("deleted_at", null);
  if (filter && ["GROUP", "DM", "GROUP_DM"].includes(filter)) q = q.eq("type", filter);
  else if (filter && filter !== "ALL") q = q.eq("status", filter);
  const { data } = await q.order("created_at", { ascending: false }).limit(200);
  return data ?? [];
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
  const [{ data: groups }, { data: recipients }, { data: logs }] = await Promise.all([
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
  ]);
  return { campaign, groups: groups ?? [], recipients: recipients ?? [], logs: logs ?? [] };
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

  // Validate group ownership server-side, never trust the ids blindly.
  if (groupIds.length) {
    const { data: groups } = await client
      .from("discovered_groups")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .in("id", groupIds)
      .in("status", ["APPROVED", "JOINED"]);
    if ((groups ?? []).length !== new Set(groupIds).size) {
      await client.from("campaigns").delete().eq("id", campaign.id).eq("tenant_id", ctx.tenantId);
      throw new Error("One or more selected groups are not approved for this account.");
    }
    const rows = (groups ?? []).map((g) => ({
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
    details: { groups: groupCount, recipients: recipientCount, connection_id: connection.id },
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
  const [{ data: campaigns }, { data: groups }, { data: contacts }] = await Promise.all([
    client
      .from("campaigns")
      .select("created_at, status, completed_count, failed_count, total_targets")
      .eq("tenant_id", t),
    client.from("discovered_groups").select("status, discovered_at").eq("tenant_id", t),
    client
      .from("audience_contacts")
      .select("contact_count, first_found_at, last_contacted_at")
      .eq("tenant_id", t),
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

  return {
    totals: {
      groupsFound: groups?.length ?? 0,
      groupsApproved: groups?.filter((g) => g.status === "APPROVED").length ?? 0,
      groupsJoined: groups?.filter((g) => g.status === "JOINED").length ?? 0,
      campaigns: campaigns?.length ?? 0,
      processed:
        campaigns?.reduce((a, c) => a + (c.completed_count ?? 0) + (c.failed_count ?? 0), 0) ?? 0,
      successful: campaigns?.reduce((a, c) => a + (c.completed_count ?? 0), 0) ?? 0,
      failed: campaigns?.reduce((a, c) => a + (c.failed_count ?? 0), 0) ?? 0,
      audience: contacts?.length ?? 0,
      contacted: contacts?.filter((c) => (c.contact_count ?? 0) > 0).length ?? 0,
      newAudience: contacts?.filter((c) => (c.contact_count ?? 0) === 0).length ?? 0,
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
