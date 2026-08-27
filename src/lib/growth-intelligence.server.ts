/* eslint-disable prefer-const */
import { Api, TelegramClient } from "telegram";
import bigInt from "big-integer";
import { db } from "./db.server";
import { withAuthorizedUserClient } from "./telegram-user-session.server";

type GrowthTarget = {
  id: string;
  tenant_id: string;
  connection_id: string;
  telegram_chat_id: number;
  access_hash: string | null;
};
export type AdminLogCheckpoint = {
  newestProcessedId?: number;
  oldestBackfilledId?: number;
  incrementalCursorMaxId?: number;
  incrementalCycleNewestId?: number;
  backfillComplete?: boolean;
  oldestEventAt?: string;
  latestEventAt?: string;
};
const PAGE = 50,
  MAX_PAGES = 2;
const safeCode = (e: unknown) =>
  (e instanceof Error ? e.message : String(e))
    .toUpperCase()
    .match(/\b(?:FLOOD_WAIT_\d+|[A-Z][A-Z0-9_]{2,})\b/)?.[0] ?? "TELEGRAM_COLLECTION_FAILED";
const floodUntil = (c: string) => {
  const s = Number(c.match(/FLOOD_WAIT_(\d+)/)?.[1] ?? 0);
  return s ? new Date(Date.now() + s * 1000).toISOString() : null;
};
const count = (f: Api.messages.ChatFull) =>
  f.fullChat instanceof Api.ChannelFull && f.fullChat.participantsCount != null
    ? Number(f.fullChat.participantsCount)
    : null;
const peerUser = (p: Api.TypeChannelParticipant) =>
  p instanceof Api.ChannelParticipantBanned || p instanceof Api.ChannelParticipantLeft
    ? p.peer instanceof Api.PeerUser
      ? Number(p.peer.userId)
      : null
    : "userId" in p
      ? Number(p.userId)
      : null;
const member = (p: Api.TypeChannelParticipant) =>
  p instanceof Api.ChannelParticipantLeft
    ? false
    : p instanceof Api.ChannelParticipantBanned
      ? !p.left && !p.bannedRights.viewMessages
      : true;

export function classifyMembershipAction(e: Api.ChannelAdminLogEvent) {
  const a = e.action;
  if (a instanceof Api.ChannelAdminLogEventActionParticipantJoin)
    return { type: "JOINED" as const, userId: Number(e.userId), source: { type: "DIRECT" } };
  if (a instanceof Api.ChannelAdminLogEventActionParticipantLeave)
    return { type: "LEFT" as const, userId: Number(e.userId), source: { type: "DIRECT" } };
  if (a instanceof Api.ChannelAdminLogEventActionParticipantJoinByInvite)
    return {
      type: "JOINED" as const,
      userId: Number(e.userId),
      source: { type: "INVITE_LINK", viaChatlist: Boolean(a.viaChatlist) },
    };
  if (a instanceof Api.ChannelAdminLogEventActionParticipantJoinByRequest)
    return {
      type: "JOINED" as const,
      userId: Number(e.userId),
      source: { type: "JOIN_REQUEST", approvedBy: String(a.approvedBy) },
    };
  if (a instanceof Api.ChannelAdminLogEventActionParticipantInvite)
    return {
      type: "JOINED" as const,
      userId: peerUser(a.participant),
      source: { type: "ADMIN_INVITE", actorUserId: String(e.userId) },
    };
  if (a instanceof Api.ChannelAdminLogEventActionParticipantToggleBan) {
    const before = member(a.prevParticipant),
      after = member(a.newParticipant);
    if (before === after) return null;
    return {
      type: after ? ("JOINED" as const) : ("LEFT" as const),
      userId: peerUser(after ? a.newParticipant : a.prevParticipant),
      source: { type: after ? "UNBAN" : "KICK_OR_BAN", actorUserId: String(e.userId) },
    };
  }
  return null;
}

export function classifyServiceMembership(message: Api.MessageService) {
  const action = message.action;
  const actorUserId = message.fromId instanceof Api.PeerUser ? Number(message.fromId.userId) : null;
  if (action instanceof Api.MessageActionChatAddUser)
    return action.users.map((id) => ({ type: "JOINED" as const, userId: Number(id), actorUserId }));
  if (action instanceof Api.MessageActionChatDeleteUser)
    return [{ type: "LEFT" as const, userId: Number(action.userId), actorUserId }];
  if (
    action instanceof Api.MessageActionChatJoinedByLink ||
    action instanceof Api.MessageActionChatJoinedByRequest
  )
    return actorUserId ? [{ type: "JOINED" as const, userId: actorUserId, actorUserId }] : [];
  return [];
}

export async function discoverAdminDestinations(
  tenantId: string,
  customerId: string,
  connectionId: string,
) {
  return withAuthorizedUserClient(tenantId, connectionId, async (client) => {
    const dialogs = await client.getDialogs({ limit: 200 }),
      out: Record<string, unknown>[] = [];
    for (const d of dialogs) {
      const e = d.entity;
      if (!(e instanceof Api.Channel) || (!e.creator && !e.adminRights)) continue;
      const full = await client.invoke(new Api.channels.GetFullChannel({ channel: e })),
        now = new Date().toISOString(),
        members = count(full);
      const { data, error } = await db()
        .from("growth_destinations")
        .upsert(
          {
            tenant_id: tenantId,
            customer_id: customerId,
            connection_id: connectionId,
            telegram_chat_id: Number(e.id),
            access_hash: e.accessHash == null ? null : String(e.accessHash),
            title: e.title,
            username: e.username ?? null,
            destination_type: e.broadcast ? "CHANNEL" : e.megagroup ? "SUPERGROUP" : "GROUP",
            admin_status: e.creator ? "CREATOR" : "ADMIN",
            capabilities: {
              creator: Boolean(e.creator),
              banUsers: Boolean(e.adminRights?.banUsers),
              inviteUsers: Boolean(e.adminRights?.inviteUsers),
              viewStatistics: Boolean(e.adminRights?.other || e.creator),
            },
            member_count: members,
            status: "ACTIVE",
            last_error_code: null,
            last_checked_at: now,
            next_collect_at: now,
            updated_at: now,
          },
          { onConflict: "tenant_id,connection_id,telegram_chat_id" },
        )
        .select("id,title,destination_type,member_count,admin_status")
        .single();
      if (error) throw new Error(error.message);
      if (members != null) {
        const b = new Date();
        b.setUTCMinutes(0, 0, 0);
        await db()
          .from("growth_snapshots")
          .upsert(
            {
              tenant_id: tenantId,
              destination_id: data.id,
              snapshot_bucket: b.toISOString(),
              member_count: members,
              available_metrics: {
                memberCount: true,
                messages: false,
                reactions: false,
                postViews: false,
                forwards: false,
                visitors: false,
              },
              collected_at: now,
            },
            { onConflict: "destination_id,snapshot_bucket" },
          );
      }
      out.push(data);
      if (out.length >= 50) break;
    }
    return out;
  });
}

async function previousChat(client: TelegramClient, user: Api.User) {
  try {
    const peer = await client.getInputEntity(user),
      h = await client.invoke(
        new Api.messages.GetHistory({
          peer,
          offsetId: 0,
          offsetDate: 0,
          addOffset: 0,
          limit: 1,
          maxId: 0,
          minId: 0,
          hash: bigInt(0),
        }),
      );
    return "messages" in h && h.messages.length ? "PREVIOUSLY_CHATTED" : "NO_KNOWN_PREVIOUS_CHAT";
  } catch {
    return "UNABLE_TO_VERIFY";
  }
}
async function persistPage(
  client: TelegramClient,
  target: GrowthTarget,
  events: Api.ChannelAdminLogEvent[],
  users: Api.TypeUser[],
) {
  const map = new Map(
    users.filter((u): u is Api.User => u instanceof Api.User).map((u) => [String(u.id), u]),
  );
  for (const e of events) {
    const m = classifyMembershipAction(e);
    if (!m?.userId) continue;
    const u = map.get(String(m.userId));
    const eventAt = new Date(e.date * 1000).toISOString();
    const { error } = await db()
      .from("growth_membership_events")
      .upsert(
        {
          tenant_id: target.tenant_id,
          destination_id: target.id,
          telegram_event_id: Number(e.id),
          source_type: "ADMIN_LOG",
          source_event_id: Number(e.id),
          actor_user_id: Number(e.userId),
          event_type: m.type,
          telegram_user_id: m.userId,
          username: u?.username ?? null,
          display_name: u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || null : null,
          event_at: eventAt,
          source_info: m.source,
          previous_chat_status:
            m.type === "LEFT" ? (u ? await previousChat(client, u) : "UNABLE_TO_VERIFY") : null,
        },
        { onConflict: "destination_id,source_type,source_event_id,telegram_user_id" },
      );
    if (error) throw new Error(error.message);
  }
}

async function persistServiceMessages(
  client: TelegramClient,
  target: GrowthTarget,
  messages: Api.TypeMessage[],
  users: Api.TypeUser[],
) {
  const map = new Map(
    users.filter((u): u is Api.User => u instanceof Api.User).map((u) => [String(u.id), u]),
  );
  for (const message of messages) {
    if (!(message instanceof Api.MessageService)) continue;
    for (const membership of classifyServiceMembership(message)) {
      const eventAt = new Date(message.date * 1000),
        from = new Date(eventAt.getTime() - 3000).toISOString(),
        to = new Date(eventAt.getTime() + 3000).toISOString();
      const { data: duplicate } = await db()
        .from("growth_membership_events")
        .select("id")
        .eq("destination_id", target.id)
        .eq("event_type", membership.type)
        .eq("telegram_user_id", membership.userId)
        .neq("source_type", "MESSAGE_SERVICE")
        .gte("event_at", from)
        .lte("event_at", to)
        .limit(1)
        .maybeSingle();
      if (duplicate) continue;
      const user = map.get(String(membership.userId));
      const { error } = await db()
        .from("growth_membership_events")
        .upsert(
          {
            tenant_id: target.tenant_id,
            destination_id: target.id,
            telegram_event_id: message.id,
            source_type: "MESSAGE_SERVICE",
            source_event_id: message.id,
            actor_user_id: membership.actorUserId,
            event_type: membership.type,
            telegram_user_id: membership.userId,
            username: user?.username ?? null,
            display_name: user
              ? [user.firstName, user.lastName].filter(Boolean).join(" ") || null
              : null,
            event_at: eventAt.toISOString(),
            source_info: { type: message.action.className },
            previous_chat_status:
              membership.type === "LEFT"
                ? user
                  ? await previousChat(client, user)
                  : "UNABLE_TO_VERIFY"
                : null,
          },
          { onConflict: "destination_id,source_type,source_event_id,telegram_user_id" },
        );
      if (error) throw new Error(error.message);
    }
  }
}

async function collectLog(
  client: TelegramClient,
  input: Api.InputChannel,
  target: GrowthTarget,
  now: string,
) {
  const store = db(),
    old = await store
      .from("growth_collection_checkpoints")
      .select("checkpoint")
      .eq("destination_id", target.id)
      .eq("collection_type", "ADMIN_LOG")
      .maybeSingle(),
    raw = old.data?.checkpoint as (AdminLogCheckpoint & { maxEventId?: number }) | null;
  let cp: AdminLogCheckpoint =
      raw?.newestProcessedId != null
        ? { ...raw }
        : {
            newestProcessedId: raw?.maxEventId ?? 0,
            oldestBackfilledId: raw?.maxEventId || undefined,
            backfillComplete: false,
          },
    pages = 0;
  const filter = new Api.ChannelAdminLogEventsFilter({
    join: true,
    leave: true,
    invite: true,
    ban: true,
    unban: true,
    kick: true,
    unkick: true,
  });
  const fetch = async (maxId: number, minId: number) => {
    const r = await client.invoke(
      new Api.channels.GetAdminLog({
        channel: input,
        q: "",
        eventsFilter: filter,
        admins: [],
        maxId: bigInt(maxId),
        minId: bigInt(minId),
        limit: PAGE,
      }),
    );
    await persistPage(client, target, r.events, r.users);
    pages++;
    return r;
  };
  if (!cp.newestProcessedId) {
    const r = await fetch(0, 0),
      ids = r.events.map((e) => Number(e.id));
    if (ids.length) {
      cp.newestProcessedId = Math.max(...ids);
      cp.oldestBackfilledId = Math.min(...ids);
      cp.latestEventAt = new Date(Math.max(...r.events.map((e) => e.date)) * 1000).toISOString();
      cp.oldestEventAt = new Date(Math.min(...r.events.map((e) => e.date)) * 1000).toISOString();
    }
    cp.backfillComplete = r.events.length < PAGE;
  } else {
    const r = await fetch(cp.incrementalCursorMaxId ?? 0, cp.newestProcessedId),
      ids = r.events.map((e) => Number(e.id));
    if (ids.length) {
      cp.incrementalCycleNewestId = Math.max(cp.incrementalCycleNewestId ?? 0, ...ids);
      cp.latestEventAt = new Date(Math.max(...r.events.map((e) => e.date)) * 1000).toISOString();
      if (r.events.length === PAGE) cp.incrementalCursorMaxId = Math.min(...ids);
      else {
        cp.newestProcessedId = Math.max(cp.newestProcessedId, cp.incrementalCycleNewestId);
        delete cp.incrementalCursorMaxId;
        delete cp.incrementalCycleNewestId;
      }
    } else {
      if (cp.incrementalCycleNewestId)
        cp.newestProcessedId = Math.max(cp.newestProcessedId, cp.incrementalCycleNewestId);
      delete cp.incrementalCursorMaxId;
      delete cp.incrementalCycleNewestId;
    }
  }
  if (
    pages < MAX_PAGES &&
    !cp.incrementalCursorMaxId &&
    !cp.backfillComplete &&
    cp.oldestBackfilledId
  ) {
    const r = await fetch(cp.oldestBackfilledId, 0),
      older = r.events.filter((e) => Number(e.id) < cp.oldestBackfilledId!);
    if (older.length) {
      cp.oldestBackfilledId = Math.min(...older.map((e) => Number(e.id)));
      cp.oldestEventAt = new Date(Math.min(...older.map((e) => e.date)) * 1000).toISOString();
    }
    cp.backfillComplete = r.events.length < PAGE || !older.length;
  }
  await store
    .from("growth_collection_checkpoints")
    .upsert({
      destination_id: target.id,
      collection_type: "ADMIN_LOG",
      checkpoint: cp,
      last_attempt_at: now,
      last_success_at: now,
      last_error_code: null,
      flood_wait_until: null,
      updated_at: now,
    });
  return cp;
}

async function collectMembershipHistory(
  client: TelegramClient,
  input: Api.InputChannel,
  target: GrowthTarget,
  now: string,
) {
  const store = db();
  const { data: saved } = await store
    .from("growth_collection_checkpoints")
    .select("checkpoint")
    .eq("destination_id", target.id)
    .eq("collection_type", "MEMBERSHIP_HISTORY")
    .maybeSingle();
  const cp: AdminLogCheckpoint = { ...((saved?.checkpoint as AdminLogCheckpoint | null) ?? {}) };
  let pages = 0;
  const save = async () => {
    const { error } = await store.from("growth_collection_checkpoints").upsert({
      destination_id: target.id,
      collection_type: "MEMBERSHIP_HISTORY",
      checkpoint: cp,
      last_attempt_at: now,
      last_success_at: now,
      last_error_code: null,
      flood_wait_until: null,
      updated_at: now,
    });
    if (error) throw new Error(error.message);
  };
  const fetch = async (maxId: number, minId: number) => {
    const result = await client.invoke(
      new Api.messages.GetHistory({
        peer: input,
        offsetId: 0,
        offsetDate: 0,
        addOffset: 0,
        limit: 100,
        maxId,
        minId,
        hash: bigInt(0),
      }),
    );
    const messages = "messages" in result ? result.messages : [];
    const users = "users" in result ? result.users : [];
    await persistServiceMessages(client, target, messages, users);
    pages++;
    return messages.filter(
      (message): message is Api.Message | Api.MessageService =>
        (message instanceof Api.Message || message instanceof Api.MessageService) && message.id > 0,
    );
  };

  if (!cp.newestProcessedId) {
    const messages = await fetch(0, 0);
    if (messages.length) {
      cp.newestProcessedId = Math.max(...messages.map((message) => message.id));
      cp.oldestBackfilledId = Math.min(...messages.map((message) => message.id));
      cp.latestEventAt = new Date(Math.max(...messages.map((message) => message.date)) * 1000).toISOString();
      cp.oldestEventAt = new Date(Math.min(...messages.map((message) => message.date)) * 1000).toISOString();
    }
    cp.backfillComplete = messages.length < 100;
    await save();
  } else {
    const messages = await fetch(cp.incrementalCursorMaxId ?? 0, cp.newestProcessedId);
    if (messages.length) {
      cp.incrementalCycleNewestId = Math.max(
        cp.incrementalCycleNewestId ?? 0,
        ...messages.map((message) => message.id),
      );
      if (messages.length === 100)
        cp.incrementalCursorMaxId = Math.min(...messages.map((message) => message.id));
      else {
        cp.newestProcessedId = Math.max(cp.newestProcessedId, cp.incrementalCycleNewestId);
        delete cp.incrementalCursorMaxId;
        delete cp.incrementalCycleNewestId;
      }
    } else {
      if (cp.incrementalCycleNewestId)
        cp.newestProcessedId = Math.max(cp.newestProcessedId, cp.incrementalCycleNewestId);
      delete cp.incrementalCursorMaxId;
      delete cp.incrementalCycleNewestId;
    }
    await save();
  }

  if (
    pages < MAX_PAGES &&
    !cp.incrementalCursorMaxId &&
    !cp.backfillComplete &&
    cp.oldestBackfilledId
  ) {
    const messages = await fetch(cp.oldestBackfilledId, 0),
      older = messages.filter((message) => message.id < cp.oldestBackfilledId!);
    if (older.length) {
      cp.oldestBackfilledId = Math.min(...older.map((message) => message.id));
      cp.oldestEventAt = new Date(Math.min(...older.map((message) => message.date)) * 1000).toISOString();
    }
    cp.backfillComplete = messages.length < 100 || !older.length;
    await save();
  }
  return cp;
}

export async function collectGrowthDestination(target: GrowthTarget) {
  const store = db(),
    now = new Date().toISOString();
  try {
    return await withAuthorizedUserClient(
      target.tenant_id,
      target.connection_id,
      async (client) => {
        const input = new Api.InputChannel({
            channelId: bigInt(target.telegram_chat_id),
            accessHash: bigInt(target.access_hash ?? "0"),
          }),
          full = await client.invoke(new Api.channels.GetFullChannel({ channel: input })),
          history = await client.invoke(
            new Api.messages.GetHistory({
              peer: input,
              offsetId: 0,
              offsetDate: 0,
              addOffset: 0,
              limit: 100,
              maxId: 0,
              minId: 0,
              hash: bigInt(0),
            }),
          ),
          messages =
            "messages" in history
              ? history.messages.filter((m): m is Api.Message => m instanceof Api.Message)
              : [];
        let views = 0,
          forwards = 0,
          reactions = 0,
          hv = false,
          hf = false,
          hr = false;
        for (const m of messages) {
          hv ||= m.views != null;
          hf ||= m.forwards != null;
          hr ||= m.reactions != null;
          views += Number(m.views ?? 0);
          forwards += Number(m.forwards ?? 0);
          const rc = m.reactions?.results?.reduce((s, x) => s + Number(x.count), 0) ?? null;
          reactions += rc ?? 0;
          await store
            .from("growth_content_metrics")
            .upsert(
              {
                tenant_id: target.tenant_id,
                destination_id: target.id,
                telegram_message_id: m.id,
                posted_at: new Date(m.date * 1000).toISOString(),
                views: m.views ?? null,
                forwards: m.forwards ?? null,
                reactions: rc,
                collected_at: now,
              },
              { onConflict: "destination_id,telegram_message_id" },
            );
        }
        const members = count(full),
          b = new Date();
        b.setUTCMinutes(0, 0, 0);
        await store
          .from("growth_snapshots")
          .upsert(
            {
              tenant_id: target.tenant_id,
              destination_id: target.id,
              snapshot_bucket: b.toISOString(),
              member_count: members,
              message_count: messages.length,
              reaction_count: hr ? reactions : null,
              post_views: hv ? views : null,
              forwards: hf ? forwards : null,
              available_metrics: {
                memberCount: members != null,
                messages: true,
                reactions: hr,
                postViews: hv,
                forwards: hf,
                visitors: false,
              },
              collected_at: now,
            },
            { onConflict: "destination_id,snapshot_bucket" },
          );
        try {
          await collectLog(client, input, target, now);
        } catch (e) {
          const code = safeCode(e),
            prior = await store
              .from("growth_collection_checkpoints")
              .select("checkpoint")
              .eq("destination_id", target.id)
              .eq("collection_type", "ADMIN_LOG")
              .maybeSingle();
          await store
            .from("growth_collection_checkpoints")
            .upsert({
              destination_id: target.id,
              collection_type: "ADMIN_LOG",
              checkpoint: prior.data?.checkpoint ?? {},
              last_attempt_at: now,
              last_error_code: code,
              flood_wait_until: floodUntil(code),
              updated_at: now,
            });
        }
        try {
          await collectMembershipHistory(client, input, target, now);
        } catch (error) {
          const code = safeCode(error),
            prior = await store
              .from("growth_collection_checkpoints")
              .select("checkpoint")
              .eq("destination_id", target.id)
              .eq("collection_type", "MEMBERSHIP_HISTORY")
              .maybeSingle();
          await store.from("growth_collection_checkpoints").upsert({
            destination_id: target.id,
            collection_type: "MEMBERSHIP_HISTORY",
            checkpoint: prior.data?.checkpoint ?? {},
            last_attempt_at: now,
            last_error_code: code,
            flood_wait_until: floodUntil(code),
            updated_at: now,
          });
        }
        await store
          .from("growth_destinations")
          .update({
            member_count: members,
            status: "ACTIVE",
            last_error_code: null,
            last_checked_at: now,
            last_collected_at: now,
            next_collect_at: new Date(Date.now() + 15 * 60_000).toISOString(),
            updated_at: now,
          })
          .eq("id", target.id)
          .eq("tenant_id", target.tenant_id);
        return { ok: true };
      },
    );
  } catch (e) {
    const code = safeCode(e);
    await store
      .from("growth_destinations")
      .update({
        status: code.includes("AUTH") ? "RECONNECT_REQUIRED" : "ERROR",
        last_error_code: code,
        next_collect_at: floodUntil(code) ?? new Date(Date.now() + 3600_000).toISOString(),
        updated_at: now,
      })
      .eq("id", target.id)
      .eq("tenant_id", target.tenant_id);
    return { ok: false, errorCode: code };
  }
}
export async function processGrowthCollection(limit = 2) {
  const { data } = await db()
    .from("growth_destinations")
    .select("id,tenant_id,connection_id,telegram_chat_id,access_hash")
    .in("status", ["ACTIVE", "ERROR"])
    .lte("next_collect_at", new Date().toISOString())
    .order("next_collect_at")
    .limit(Math.max(1, Math.min(limit, 5)));
  const out = [];
  for (const t of (data ?? []) as GrowthTarget[]) out.push(await collectGrowthDestination(t));
  return out;
}
