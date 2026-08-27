import { Api } from "telegram";
import bigInt from "big-integer";
import { db } from "./db.server";
import { withAuthorizedUserClient } from "./telegram-user-session.server";

type GrowthTarget = { id: string; tenant_id: string; connection_id: string; telegram_chat_id: number; access_hash: string | null };

function safeCode(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return text.toUpperCase().match(/\b(?:FLOOD_WAIT_\d+|[A-Z][A-Z0-9_]{2,})\b/)?.[0] ?? "TELEGRAM_COLLECTION_FAILED";
}

function floodUntil(code: string) {
  const seconds = Number(code.match(/FLOOD_WAIT_(\d+)/)?.[1] ?? 0);
  return seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : null;
}

function channelType(channel: Api.Channel) {
  return channel.broadcast ? "CHANNEL" : channel.megagroup ? "SUPERGROUP" : "GROUP";
}

function channelAccessHash(channel: Api.Channel) {
  return channel.accessHash == null ? null : String(channel.accessHash);
}

function participantCount(full: Api.messages.ChatFull) {
  return full.fullChat instanceof Api.ChannelFull ? Number(full.fullChat.participantsCount ?? 0) || null : null;
}

export async function discoverAdminDestinations(tenantId: string, customerId: string, connectionId: string) {
  return withAuthorizedUserClient(tenantId, connectionId, async (client) => {
    const dialogs = await client.getDialogs({ limit: 200 });
    const discovered = [] as Record<string, unknown>[];
    for (const dialog of dialogs) {
      const entity = dialog.entity;
      if (!(entity instanceof Api.Channel) || (!entity.creator && !entity.adminRights)) continue;
      const full = await client.invoke(new Api.channels.GetFullChannel({ channel: entity }));
      const capabilities = {
        creator: Boolean(entity.creator),
        postMessages: Boolean(entity.adminRights?.postMessages),
        deleteMessages: Boolean(entity.adminRights?.deleteMessages),
        banUsers: Boolean(entity.adminRights?.banUsers),
        inviteUsers: Boolean(entity.adminRights?.inviteUsers),
        viewStatistics: Boolean(entity.adminRights?.other || entity.creator),
      };
      const row = {
        tenant_id: tenantId,
        customer_id: customerId,
        connection_id: connectionId,
        telegram_chat_id: Number(entity.id),
        access_hash: channelAccessHash(entity),
        title: entity.title,
        username: entity.username ?? null,
        destination_type: channelType(entity),
        admin_status: entity.creator ? "CREATOR" : "ADMIN",
        capabilities,
        member_count: participantCount(full),
        status: "ACTIVE",
        last_error_code: null,
        last_checked_at: new Date().toISOString(),
        next_collect_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await db().from("growth_destinations").upsert(row, { onConflict: "tenant_id,connection_id,telegram_chat_id" }).select("id,title,destination_type,member_count,admin_status").single();
      if (error) throw new Error(error.message);
      discovered.push(data);
      if (discovered.length >= 50) break;
    }
    return discovered;
  });
}

async function previousChatStatus(client: import("telegram").TelegramClient, user: Api.User) {
  try {
    const peer = await client.getInputEntity(user);
    const history = await client.invoke(new Api.messages.GetHistory({ peer, offsetId: 0, offsetDate: 0, addOffset: 0, limit: 1, maxId: 0, minId: 0, hash: bigInt(0) }));
    return "messages" in history && history.messages.length ? "PREVIOUSLY_CHATTED" : "NO_KNOWN_PREVIOUS_CHAT";
  } catch {
    return "UNABLE_TO_VERIFY";
  }
}

export async function collectGrowthDestination(target: GrowthTarget) {
  const clientDb = db();
  const attemptedAt = new Date().toISOString();
  try {
    return await withAuthorizedUserClient(target.tenant_id, target.connection_id, async (client) => {
      const input = new Api.InputChannel({ channelId: bigInt(target.telegram_chat_id), accessHash: bigInt(target.access_hash ?? "0") });
      const full = await client.invoke(new Api.channels.GetFullChannel({ channel: input }));
      const history = await client.invoke(new Api.messages.GetHistory({ peer: input, offsetId: 0, offsetDate: 0, addOffset: 0, limit: 100, maxId: 0, minId: 0, hash: bigInt(0) }));
      const messages = "messages" in history ? history.messages.filter((message): message is Api.Message => message instanceof Api.Message) : [];
      let views = 0;
      let forwards = 0;
      let reactions = 0;
      for (const message of messages) {
        views += Number(message.views ?? 0);
        forwards += Number(message.forwards ?? 0);
        const reactionCount = message.reactions?.results?.reduce((sum, item) => sum + Number(item.count), 0) ?? 0;
        reactions += reactionCount;
        await clientDb.from("growth_content_metrics").upsert({
          tenant_id: target.tenant_id, destination_id: target.id, telegram_message_id: message.id,
          posted_at: new Date(message.date * 1000).toISOString(), views: message.views ?? null,
          forwards: message.forwards ?? null, reactions: reactionCount, collected_at: attemptedAt,
        }, { onConflict: "destination_id,telegram_message_id" });
      }
      const bucket = new Date();
      bucket.setUTCMinutes(0, 0, 0);
      await clientDb.from("growth_snapshots").upsert({
        tenant_id: target.tenant_id, destination_id: target.id, snapshot_bucket: bucket.toISOString(),
        member_count: participantCount(full), message_count: messages.length,
        reaction_count: reactions, post_views: views, forwards,
        available_metrics: { memberCount: participantCount(full) != null, messages: true, reactions: true, postViews: true, forwards: true, visitors: false },
        collected_at: attemptedAt,
      }, { onConflict: "destination_id,snapshot_bucket" });

      const checkpointResult = await clientDb.from("growth_collection_checkpoints").select("checkpoint").eq("destination_id", target.id).eq("collection_type", "ADMIN_LOG").maybeSingle();
      const minId = Number((checkpointResult.data?.checkpoint as { maxEventId?: number } | null)?.maxEventId ?? 0);
      try {
        const log = await client.invoke(new Api.channels.GetAdminLog({ channel: input, q: "", eventsFilter: new Api.ChannelAdminLogEventsFilter({ join: true, leave: true }), admins: [], maxId: bigInt(0), minId: bigInt(minId), limit: 50 }));
        const users = new Map(log.users.filter((user): user is Api.User => user instanceof Api.User).map((user) => [String(user.id), user]));
        let maxEventId = minId;
        for (const event of log.events) {
          const joined = event.action instanceof Api.ChannelAdminLogEventActionParticipantJoin;
          const left = event.action instanceof Api.ChannelAdminLogEventActionParticipantLeave;
          if (!joined && !left) continue;
          maxEventId = Math.max(maxEventId, Number(event.id));
          const user = users.get(String(event.userId));
          await clientDb.from("growth_membership_events").upsert({
            tenant_id: target.tenant_id, destination_id: target.id, telegram_event_id: Number(event.id),
            event_type: joined ? "JOINED" : "LEFT", telegram_user_id: Number(event.userId),
            username: user?.username ?? null, display_name: user ? [user.firstName, user.lastName].filter(Boolean).join(" ") || null : null,
            event_at: new Date(event.date * 1000).toISOString(), source_info: null,
            previous_chat_status: left && user ? await previousChatStatus(client, user) : null,
          }, { onConflict: "destination_id,telegram_event_id" });
        }
        await clientDb.from("growth_collection_checkpoints").upsert({ destination_id: target.id, collection_type: "ADMIN_LOG", checkpoint: { maxEventId }, last_attempt_at: attemptedAt, last_success_at: attemptedAt, last_error_code: null, flood_wait_until: null, updated_at: attemptedAt });
      } catch (adminLogError) {
        const adminLogCode = safeCode(adminLogError);
        await clientDb.from("growth_collection_checkpoints").upsert({ destination_id: target.id, collection_type: "ADMIN_LOG", checkpoint: { maxEventId: minId }, last_attempt_at: attemptedAt, last_error_code: adminLogCode, flood_wait_until: floodUntil(adminLogCode), updated_at: attemptedAt });
      }
      await clientDb.from("growth_destinations").update({ member_count: participantCount(full), status: "ACTIVE", last_error_code: null, last_checked_at: attemptedAt, last_collected_at: attemptedAt, next_collect_at: new Date(Date.now() + 15 * 60_000).toISOString(), updated_at: attemptedAt }).eq("id", target.id).eq("tenant_id", target.tenant_id);
      return { ok: true };
    });
  } catch (error) {
    const code = safeCode(error);
    await clientDb.from("growth_collection_checkpoints").upsert({ destination_id: target.id, collection_type: "SNAPSHOT", checkpoint: {}, last_attempt_at: attemptedAt, last_error_code: code, flood_wait_until: floodUntil(code), updated_at: attemptedAt });
    await clientDb.from("growth_destinations").update({ status: code.includes("AUTH") ? "RECONNECT_REQUIRED" : "ERROR", last_error_code: code, next_collect_at: floodUntil(code) ?? new Date(Date.now() + 60 * 60_000).toISOString(), updated_at: attemptedAt }).eq("id", target.id).eq("tenant_id", target.tenant_id);
    return { ok: false, errorCode: code };
  }
}

export async function processGrowthCollection(limit = 2) {
  const { data } = await db().from("growth_destinations").select("id,tenant_id,connection_id,telegram_chat_id,access_hash").in("status", ["ACTIVE", "ERROR"]).lte("next_collect_at", new Date().toISOString()).order("next_collect_at").limit(Math.max(1, Math.min(limit, 5)));
  const results = [];
  for (const target of (data ?? []) as GrowthTarget[]) results.push(await collectGrowthDestination(target));
  return results;
}
