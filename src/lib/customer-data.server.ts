import { db, getSetting, logSystem, notify } from "./db.server";
import type { AuthContext } from "./customer-auth.server";
import { callBot, botToken } from "./telegram.server";

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

  const [
    connections,
    activeConnections,
    issueConnections,
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
    unread,
  ] = await Promise.all([
    count("telegram_connections"),
    count("telegram_connections", { status: "CONNECTED" }),
    count("telegram_connections", { status: "ERROR" }),
    count("discovered_groups"),
    count("discovered_groups", { status: "PENDING" }),
    count("discovered_groups", { status: "APPROVED" }),
    count("discovered_groups", { status: "JOINED" }),
    count("audience_contacts"),
    count("audience_contacts", { status: "CONTACTED" }),
    count("campaigns", { status: "RUNNING" }),
    count("campaigns", { status: "SCHEDULED" }),
    count("campaigns", { status: "COMPLETED" }),
    count("campaigns", { status: "FAILED" }),
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
    connections: { total: connections, active: activeConnections, issues: issueConnections },
    groups: { found: groupsFound, pending: groupsPending, approved: groupsApproved, joined: groupsJoined },
    audience: {
      total: audienceTotal,
      contacted: audienceContacted,
      available: Math.max(audienceTotal - audienceContacted, 0),
    },
    campaigns: { running, scheduled, completed, failed },
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
    .select("*")
    .eq("tenant_id", ctx.tenantId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function createConnection(ctx: AuthContext, label: string) {
  const client = db();
  const tenant = await tenantOverview(ctx);
  const limit = Number(
    (tenant as { plans?: Record<string, number> } | null)?.plans?.["max_connections"] ?? 0,
  );
  const { count } = await client
    .from("telegram_connections")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId);
  if (limit && (count ?? 0) >= limit) throw new Error(`Your plan allows ${limit} connection(s).`);

  const { data, error } = await client
    .from("telegram_connections")
    .insert({ tenant_id: ctx.tenantId, label: label.trim() || "Telegram account", status: "REQUIRES_ACTION" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logSystem({ tenant_id: ctx.tenantId, customer_id: ctx.customerId, action: "CONNECTION_CREATED" });
  return data;
}

/**
 * Verifies the connection against Telegram. The authorized mechanism here is the platform bot:
 * the customer sends /link <code> to the bot from the Telegram account they want to connect,
 * or the bot identity is checked. No credentials are ever collected from the customer.
 */
export async function checkConnection(ctx: AuthContext, connectionId: string) {
  const client = db();
  const { data: conn } = await client
    .from("telegram_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!conn) throw new Error("Connection not found.");

  if (!botToken()) {
    await client
      .from("telegram_connections")
      .update({ status: "ERROR", error_message: "Telegram bot token is not configured", last_sync_at: new Date().toISOString() })
      .eq("id", connectionId);
    return { ok: false, error: "Telegram bot token is not configured" };
  }

  if (!conn.telegram_id) {
    await client
      .from("telegram_connections")
      .update({
        status: "REQUIRES_ACTION",
        error_message: "Send /link to the bot from the Telegram account you want to connect.",
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", connectionId);
    return { ok: false, error: "Awaiting authorization from Telegram." };
  }

  const res = await callBot<{ status: string }>("getChat", { chat_id: conn.telegram_id });
  await client
    .from("telegram_connections")
    .update({
      status: res.ok ? "CONNECTED" : "ERROR",
      error_message: res.ok ? null : res.error,
      last_sync_at: new Date().toISOString(),
      last_active_at: res.ok ? new Date().toISOString() : conn.last_active_at,
    })
    .eq("id", connectionId);
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function disconnectConnection(ctx: AuthContext, connectionId: string) {
  await db()
    .from("telegram_connections")
    .update({ status: "DISCONNECTED", error_message: null })
    .eq("id", connectionId)
    .eq("tenant_id", ctx.tenantId);
  await logSystem({ tenant_id: ctx.tenantId, customer_id: ctx.customerId, action: "CONNECTION_DISCONNECTED" });
}

export async function deleteConnection(ctx: AuthContext, connectionId: string) {
  await db().from("telegram_connections").delete().eq("id", connectionId).eq("tenant_id", ctx.tenantId);
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
  await db().from("keywords").upsert(
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
 * Group discovery. A public-directory provider must be configured by the platform admin;
 * without it we do NOT fake results - the customer adds public groups by @username instead,
 * which is resolved through the official Bot API.
 */
export async function discoverGroups(ctx: AuthContext, keywords: string[]) {
  const s = await getSetting<{ provider_url?: string; provider_key?: string }>("discovery");
  if (!s.provider_url) {
    return { configured: false as const, added: 0, results: [] };
  }
  const res = await fetch(s.provider_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(s.provider_key ? { Authorization: `Bearer ${s.provider_key}` } : {}),
    },
    body: JSON.stringify({ keywords }),
  });
  if (!res.ok) throw new Error(`Discovery provider failed [${res.status}]: ${await res.text()}`);
  const payload = (await res.json()) as {
    groups?: { title: string; username: string; member_count?: number; keywords?: string[] }[];
  };
  const rows = (payload.groups ?? []).map((g) => ({
    tenant_id: ctx.tenantId,
    title: g.title,
    username: g.username.replace(/^@/, ""),
    member_count: g.member_count ?? null,
    matched_keywords: g.keywords ?? keywords,
    status: "PENDING",
  }));
  if (rows.length)
    await db().from("discovered_groups").upsert(rows, { onConflict: "tenant_id,username", ignoreDuplicates: true });
  await logSystem({ tenant_id: ctx.tenantId, action: "GROUP_DISCOVERY", details: { keywords, found: rows.length } });
  return { configured: true as const, added: rows.length, results: rows };
}

/** Resolves a public group by @username through the official Bot API. */
export async function addGroupByUsername(ctx: AuthContext, username: string, keywords: string[]) {
  const handle = username.trim().replace(/^@/, "");
  if (!handle) throw new Error("Enter a group @username.");
  if (!botToken()) throw new Error("Telegram bot token is not configured.");

  const chat = await callBot<{ id: number; title: string; type: string; username?: string }>("getChat", {
    chat_id: `@${handle}`,
  });
  if (!chat.ok) throw new Error(chat.error);
  if (!["group", "supergroup", "channel"].includes(chat.result.type))
    throw new Error("That username is not a public group or channel.");

  const members = await callBot<number>("getChatMemberCount", { chat_id: chat.result.id });

  const { data, error } = await db()
    .from("discovered_groups")
    .upsert(
      {
        tenant_id: ctx.tenantId,
        title: chat.result.title,
        username: handle,
        telegram_group_id: chat.result.id,
        member_count: members.ok ? members.result : null,
        matched_keywords: keywords,
        status: "PENDING",
      },
      { onConflict: "tenant_id,username" },
    )
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logSystem({ tenant_id: ctx.tenantId, action: "GROUP_FOUND", resource: handle });
  return data;
}

export async function listGroups(ctx: AuthContext, status?: string) {
  let q = db().from("discovered_groups").select("*").eq("tenant_id", ctx.tenantId);
  if (status && status !== "ALL") q = q.eq("status", status);
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
  await db().from("discovered_groups").delete().eq("id", groupId).eq("tenant_id", ctx.tenantId);
}

/**
 * Approves a group and verifies real access: the platform bot must be a member of the group
 * (added by a group admin). We never silently join and never bypass Telegram permissions.
 */
export async function approveGroup(ctx: AuthContext, groupId: string, connectionId?: string | null) {
  const client = db();
  const { data: group } = await client
    .from("discovered_groups")
    .select("*")
    .eq("id", groupId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!group) throw new Error("Group not found.");

  const tenant = await tenantOverview(ctx);
  const limit = Number((tenant as { plans?: Record<string, number> } | null)?.plans?.["max_groups"] ?? 0);
  const { count } = await client
    .from("discovered_groups")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId)
    .in("status", ["APPROVED", "JOINED"]);
  if (limit && (count ?? 0) >= limit) throw new Error(`Your plan allows ${limit} active group(s).`);

  await client
    .from("discovered_groups")
    .update({ status: "APPROVED", approved_at: new Date().toISOString(), connection_id: connectionId ?? null })
    .eq("id", groupId);

  const me = await callBot<{ id: number }>("getMe", {});
  if (!me.ok) {
    await client.from("discovered_groups").update({ status: "REQUIRES_ACTION", join_error: me.error }).eq("id", groupId);
    await notify(ctx.tenantId, "Group approval needs attention", `${group.title}: ${me.error}`, "WARNING");
    return { status: "REQUIRES_ACTION", error: me.error };
  }

  const chatId = group.telegram_group_id ?? `@${group.username}`;
  const member = await callBot<{ status: string }>("getChatMember", { chat_id: chatId, user_id: me.result.id });

  if (member.ok && ["member", "administrator", "creator"].includes(member.result.status)) {
    await client
      .from("discovered_groups")
      .update({ status: "JOINED", joined_at: new Date().toISOString(), join_error: null })
      .eq("id", groupId);
    await client.from("group_memberships").upsert(
      {
        tenant_id: ctx.tenantId,
        group_id: groupId,
        connection_id: connectionId ?? null,
        status: "JOINED",
        joined_at: new Date().toISOString(),
      },
      { onConflict: "group_id,connection_id" },
    );
    await notify(ctx.tenantId, "Group ready", `${group.title} is connected and ready for promotion.`, "SUCCESS");
    await logSystem({ tenant_id: ctx.tenantId, action: "GROUP_JOINED", resource: group.username });
    return { status: "JOINED" };
  }

  const reason = member.ok
    ? "The bot is not a member of this group. Ask a group admin to add it."
    : member.error;
  await client.from("discovered_groups").update({ status: "REQUIRES_ACTION", join_error: reason }).eq("id", groupId);
  await notify(ctx.tenantId, "Action required", `${group.title}: ${reason}`, "WARNING");
  return { status: "REQUIRES_ACTION", error: reason };
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
    .select("id, telegram_user_id, display_name, username, source_group_id, eligibility, status, contact_count, first_found_at, last_contacted_at")
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
  const eligible = unique.filter((u) => u.eligibility === "ELIGIBLE" || u.eligibility === "OPTED_IN");
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
  let q = db().from("campaigns").select("*").eq("tenant_id", ctx.tenantId);
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
    client.from("campaign_groups").select("*, discovered_groups(title, username)").eq("campaign_id", id),
    client.from("campaign_recipients").select("*").eq("campaign_id", id).limit(500),
    client.from("campaign_logs").select("*").eq("campaign_id", id).order("created_at", { ascending: false }).limit(100),
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
    message: { text?: string; media_type?: string | null; media_url?: string | null; buttons?: { text: string; url: string }[] };
    group_ids: string[];
    contact_ids: string[];
    scheduled_at?: string | null;
    start_now: boolean;
  },
) {
  const client = db();
  if (!input.name.trim()) throw new Error("Give the campaign a name.");
  if (!input.message.text && !input.message.media_url) throw new Error("The message cannot be empty.");
  if (input.type !== "DM" && input.group_ids.length === 0) throw new Error("Select at least one group.");
  if (input.type !== "GROUP" && input.contact_ids.length === 0) throw new Error("Select at least one recipient.");

  const tenant = await tenantOverview(ctx);
  const plan = (tenant as { plans?: Record<string, number> } | null)?.plans ?? {};
  const messagesUsed = (tenant as { messages_used?: number } | null)?.messages_used ?? 0;
  const limit = Number(plan["monthly_message_limit"] ?? 0);
  const targetCount = input.group_ids.length + input.contact_ids.length;
  if (limit && messagesUsed + targetCount > limit)
    throw new Error(`This campaign exceeds your monthly message limit (${limit}).`);

  const status = input.start_now ? "RUNNING" : input.scheduled_at ? "SCHEDULED" : "PENDING_APPROVAL";

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
      scheduled_at: input.scheduled_at ?? null,
      started_at: input.start_now ? new Date().toISOString() : null,
      total_targets: targetCount,
    })
    .select("*")
    .single();
  if (error || !campaign) throw new Error(error?.message ?? "Could not create the campaign.");

  // Validate group ownership server-side, never trust the ids blindly.
  if (input.group_ids.length) {
    const { data: groups } = await client
      .from("discovered_groups")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .in("id", input.group_ids)
      .in("status", ["APPROVED", "JOINED"]);
    const rows = (groups ?? []).map((g) => ({
      campaign_id: campaign.id,
      tenant_id: ctx.tenantId,
      group_id: g.id,
      status: "PENDING",
    }));
    if (rows.length) await client.from("campaign_groups").upsert(rows, { onConflict: "campaign_id,group_id" });
  }

  if (input.contact_ids.length) {
    const { data: contacts } = await client
      .from("audience_contacts")
      .select("id, telegram_user_id")
      .eq("tenant_id", ctx.tenantId)
      .in("id", input.contact_ids)
      .in("eligibility", ["ELIGIBLE", "OPTED_IN"]);
    // Dedupe by telegram user id so a user in several groups is contacted once.
    const unique = new Map<number, { id: string; telegram_user_id: number }>();
    for (const c of contacts ?? []) unique.set(c.telegram_user_id as number, c as never);
    const rows = [...unique.values()].map((c) => ({
      campaign_id: campaign.id,
      tenant_id: ctx.tenantId,
      contact_id: c.id,
      telegram_user_id: c.telegram_user_id,
      status: "PENDING",
    }));
    if (rows.length)
      await client.from("campaign_recipients").upsert(rows, { onConflict: "campaign_id,telegram_user_id" });
  }

  await enqueueCampaignJobs(campaign.id as string, ctx.tenantId, input.start_now);

  const groupCount =
    (await client.from("campaign_groups").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id)).count ?? 0;
  const recipientCount =
    (await client.from("campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id)).count ?? 0;
  await client.from("campaigns").update({ total_targets: groupCount + recipientCount }).eq("id", campaign.id);

  await logSystem({ tenant_id: ctx.tenantId, customer_id: ctx.customerId, action: "CAMPAIGN_CREATED", resource: campaign.name });
  await notify(ctx.tenantId, "Campaign created", `${campaign.name} is ${status.toLowerCase()}.`);
  return campaign;
}

export async function enqueueCampaignJobs(campaignId: string, tenantId: string, startNow: boolean) {
  const client = db();
  const [{ data: groups }, { data: recipients }] = await Promise.all([
    client.from("campaign_groups").select("id").eq("campaign_id", campaignId),
    client.from("campaign_recipients").select("id").eq("campaign_id", campaignId),
  ]);
  const jobs = [
    ...(groups ?? []).map((g) => ({ job_type: "GROUP", target_id: g.id as string })),
    ...(recipients ?? []).map((r) => ({ job_type: "DM", target_id: r.id as string })),
  ].map((j) => ({
    campaign_id: campaignId,
    tenant_id: tenantId,
    job_type: j.job_type,
    target_id: j.target_id,
    status: startNow ? "QUEUED" : "HELD",
  }));
  if (jobs.length)
    await client.from("campaign_jobs").upsert(jobs, { onConflict: "campaign_id,job_type,target_id", ignoreDuplicates: true });
}

export async function controlCampaign(ctx: AuthContext, id: string, action: "START" | "PAUSE" | "RESUME" | "STOP") {
  const client = db();
  const { data: campaign } = await client
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!campaign) throw new Error("Campaign not found.");

  const map = { START: "RUNNING", RESUME: "RUNNING", PAUSE: "PAUSED", STOP: "CANCELLED" } as const;
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
    await client.from("campaign_jobs").update({ status: "QUEUED" }).eq("campaign_id", id).in("status", ["HELD", "PAUSED"]);
  } else if (status === "PAUSED") {
    await client.from("campaign_jobs").update({ status: "PAUSED" }).eq("campaign_id", id).eq("status", "QUEUED");
  } else {
    await client.from("campaign_jobs").update({ status: "CANCELLED" }).eq("campaign_id", id).in("status", ["QUEUED", "PAUSED", "HELD"]);
  }
  await logSystem({ tenant_id: ctx.tenantId, customer_id: ctx.customerId, action: `CAMPAIGN_${action}`, resource: campaign.name });
  return { status };
}

/* --------------------------------- analytics -------------------------------------- */

export async function analytics(ctx: AuthContext) {
  const client = db();
  const t = ctx.tenantId;
  const [{ data: campaigns }, { data: groups }, { data: contacts }] = await Promise.all([
    client.from("campaigns").select("created_at, status, completed_count, failed_count, total_targets").eq("tenant_id", t),
    client.from("discovered_groups").select("status, discovered_at").eq("tenant_id", t),
    client.from("audience_contacts").select("contact_count, first_found_at, last_contacted_at").eq("tenant_id", t),
  ]);

  const days = [...Array(14)].map((_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400_000);
    return d.toISOString().slice(0, 10);
  });
  const byDay = (rows: { at: string | null }[]) =>
    days.map((day) => ({ day: day.slice(5), value: rows.filter((r) => r.at?.slice(0, 10) === day).length }));

  return {
    totals: {
      groupsFound: groups?.length ?? 0,
      groupsApproved: groups?.filter((g) => g.status === "APPROVED").length ?? 0,
      groupsJoined: groups?.filter((g) => g.status === "JOINED").length ?? 0,
      campaigns: campaigns?.length ?? 0,
      processed: campaigns?.reduce((a, c) => a + (c.completed_count ?? 0) + (c.failed_count ?? 0), 0) ?? 0,
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
  const [tenant, { data: plans }, { data: subscription }, { data: transactions }, payments] = await Promise.all([
    tenantOverview(ctx),
    client.from("plans").select("*").eq("is_active", true).order("sort_order"),
    client.from("subscriptions").select("*, plans(name, price_usd)").eq("tenant_id", ctx.tenantId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    client.from("billing_transactions").select("*, plans(name)").eq("tenant_id", ctx.tenantId).order("created_at", { ascending: false }).limit(50),
    getSetting<{ payment_enabled?: boolean; network?: string; wallet_address?: string }>("payments"),
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
  const payments = await getSetting<{ payment_enabled?: boolean; network?: string; wallet_address?: string }>("payments");
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
