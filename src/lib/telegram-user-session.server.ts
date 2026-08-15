import { TelegramClient } from "telegram";
import { Api } from "telegram/tl";
import { StringSession } from "telegram/sessions";
import bigInt from "big-integer";
import type { AuthContext } from "./customer-auth.server";
import { db, logSystem } from "./db.server";
import { decryptSecret, encryptSecret } from "./security.server";
import type { MessagePayload } from "./telegram.server";

const CONNECTION_RETRIES = 3;
const MAX_SESSIONS = 20;

type ConnectionRow = {
  id: string;
  tenant_id: string;
  label: string;
  encrypted_session?: string | null;
  pending_session?: string | null;
  pending_phone?: string | null;
  phone_code_hash?: string | null;
  status: string;
  cooldown_until?: string | null;
  health?: string | null;
};

function credentials() {
  const apiId = Number(process.env["TELEGRAM_API_ID"]);
  const apiHash = process.env["TELEGRAM_API_HASH"]?.trim() ?? "";
  if (!Number.isInteger(apiId) || apiId <= 0 || !apiHash) {
    throw new Error(
      "TELEGRAM_API_ID and TELEGRAM_API_HASH are required for Telegram user sessions.",
    );
  }
  return { apiId, apiHash };
}

function clientFromSession(session: string) {
  const { apiId, apiHash } = credentials();
  return new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: CONNECTION_RETRIES,
  });
}

function savedSession(client: TelegramClient) {
  return (client.session as StringSession).save();
}

function maskPhone(phone: string) {
  const clean = phone.replace(/\s+/g, "");
  if (clean.length <= 5) return clean.replace(/\d/g, "*");
  return `${clean.slice(0, 3)}${"*".repeat(Math.max(clean.length - 6, 3))}${clean.slice(-3)}`;
}

function normalizePhone(phone: string) {
  const value = phone.replace(/[^\d+]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(value)) {
    throw new Error(
      "Enter a valid phone number in international format, for example +15551234567.",
    );
  }
  return value;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "errorMessage" in error) {
    return String((error as { errorMessage?: string }).errorMessage);
  }
  return "Telegram operation failed.";
}

function accessHash(value: unknown) {
  if (!value || typeof value !== "object" || !("accessHash" in value)) return null;
  const hash = (value as { accessHash?: { toString?: () => string } | string | number }).accessHash;
  return hash == null ? null : String(hash);
}

function entityType(entity: unknown) {
  if (entity instanceof Api.Channel) {
    return entity.megagroup ? "MEGAGROUP" : "CHANNEL";
  }
  if (entity instanceof Api.Chat) return "CHAT";
  if (entity instanceof Api.User) return "USER";
  return "UNKNOWN";
}

function channelWritable(entity: Api.Channel) {
  const row = entity as Api.Channel & {
    creator?: boolean;
    adminRights?: { postMessages?: boolean } | null;
    defaultBannedRights?: { sendMessages?: boolean } | null;
  };
  if (row.broadcast && !row.creator && !row.adminRights?.postMessages) return false;
  if (row.defaultBannedRights?.sendMessages) return false;
  return true;
}

function inputChannelFromStored(target: { id?: number | null; accessHash?: string | null }) {
  if (!target.id || !target.accessHash) return null;
  return new Api.InputChannel({
    channelId: bigInt(String(target.id)),
    accessHash: bigInt(String(target.accessHash)),
  });
}

async function resolveSendEntity(
  client: TelegramClient,
  target: {
    id?: number | null;
    username?: string | null;
    accessHash?: string | null;
    entityType?: string | null;
  },
) {
  if (target.username) return client.getEntity(target.username.replace(/^@/, ""));
  if (target.id && target.accessHash && target.entityType === "USER") {
    return new Api.InputPeerUser({
      userId: bigInt(String(target.id)),
      accessHash: bigInt(String(target.accessHash)),
    });
  }
  if (target.id && target.accessHash && ["CHANNEL", "MEGAGROUP"].includes(target.entityType ?? "")) {
    return new Api.InputPeerChannel({
      channelId: bigInt(String(target.id)),
      accessHash: bigInt(String(target.accessHash)),
    });
  }
  if (target.id && target.entityType === "CHAT") {
    return new Api.InputPeerChat({ chatId: bigInt(String(target.id)) });
  }
  throw new Error("ENTITY_UNAVAILABLE: target cannot be resolved without username or access hash.");
}

function errorCode(error: unknown) {
  if (typeof error === "object" && error && "errorMessage" in error) {
    return String((error as { errorMessage?: string }).errorMessage);
  }
  return errorMessage(error);
}

function invalidSessionError(error: unknown) {
  const upper = errorCode(error).toUpperCase();
  return (
    upper.includes("AUTH_KEY_UNREGISTERED") ||
    upper.includes("SESSION_REVOKED") ||
    upper.includes("SESSION_EXPIRED") ||
    upper.includes("USER_DEACTIVATED") ||
    upper.includes("USER_DEACTIVATED_BAN")
  );
}

function classifyAudienceError(error: unknown) {
  const message = errorMessage(error);
  const upper = message.toUpperCase();
  if (upper.includes("CHAT_ADMIN_REQUIRED") || upper.includes("USER_NOT_PARTICIPANT")) {
    return { status: "PERMISSION_REQUIRED" as const, reason: message };
  }
  if (
    upper.includes("CHANNEL_PRIVATE") ||
    upper.includes("INVITE") ||
    upper.includes("USERNAME_NOT_OCCUPIED") ||
    upper.includes("NOT FOUND")
  ) {
    return { status: "NOT_ACCESSIBLE" as const, reason: message };
  }
  if (
    upper.includes("PARTICIPANTS") ||
    upper.includes("HIDDEN") ||
    upper.includes("FORBIDDEN")
  ) {
    return { status: "MEMBERS_NOT_EXPOSED" as const, reason: message };
  }
  return { status: "FAILED" as const, reason: message };
}

function publicFields() {
  return "id, tenant_id, label, account_name, username, telegram_id, telegram_user_id, phone_masked, status, health, error_message, restriction_status, restriction_reason, last_active_at, last_used_at, last_sync_at, cooldown_until, auth_step, created_at, updated_at";
}

async function ownedConnection(ctx: AuthContext, connectionId: string) {
  const { data } = await db()
    .from("telegram_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!data) throw new Error("Telegram session not found.");
  return data as ConnectionRow & Record<string, unknown>;
}

async function ensureLimit(ctx: AuthContext) {
  const { count } = await db()
    .from("telegram_connections")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", ctx.tenantId)
    .neq("status", "DISCONNECTED");
  if ((count ?? 0) >= MAX_SESSIONS)
    throw new Error("A customer can connect up to 20 Telegram sessions.");
}

async function saveConnectedProfile(
  ctx: AuthContext,
  connectionId: string,
  client: TelegramClient,
  user: Api.User,
) {
  const session = savedSession(client);
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const { data, error } = await db()
    .from("telegram_connections")
    .update({
      encrypted_session: encryptSecret(session),
      pending_session: null,
      pending_phone: null,
      phone_code_hash: null,
      auth_step: null,
      telegram_id: Number(user.id),
      telegram_user_id: Number(user.id),
      username: user.username ?? null,
      account_name: fullName || user.username || "Telegram account",
      status: "CONNECTED",
      health: "HEALTHY",
      restriction_status: "NONE",
      restriction_reason: null,
      error_message: null,
      last_active_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
    .eq("tenant_id", ctx.tenantId)
    .select(publicFields())
    .single();
  if (error) throw new Error(error.message);
  await logSystem({
    tenant_id: ctx.tenantId,
    customer_id: ctx.customerId,
    action: "MT_USER_SESSION_CONNECTED",
    resource: user.username ? `@${user.username}` : String(user.id),
  });
  return data;
}

export async function startUserSessionLogin(
  ctx: AuthContext,
  input: { label: string; phone: string },
) {
  await ensureLimit(ctx);
  const phone = normalizePhone(input.phone);
  const client = clientFromSession("");
  await client.connect();
  try {
    const sent = await client.sendCode(credentials(), phone);
    const pendingSession = savedSession(client);
    const { data, error } = await db()
      .from("telegram_connections")
      .insert({
        tenant_id: ctx.tenantId,
        label: input.label.trim() || "Telegram account",
        phone_masked: maskPhone(phone),
        pending_phone: encryptSecret(phone),
        pending_session: encryptSecret(pendingSession),
        phone_code_hash: sent.phoneCodeHash,
        auth_step: "CODE",
        status: "AUTH_CODE_SENT",
        health: "REQUIRES_CODE",
        restriction_status: "NONE",
        error_message: null,
      })
      .select(publicFields())
      .single();
    if (error) throw new Error(error.message);
    await logSystem({
      tenant_id: ctx.tenantId,
      customer_id: ctx.customerId,
      action: "MT_CODE_SENT",
    });
    return { connection: data, step: "CODE" as const, isCodeViaApp: sent.isCodeViaApp };
  } finally {
    await client.disconnect();
  }
}

export async function completeUserSessionCode(
  ctx: AuthContext,
  input: { connectionId: string; code: string },
) {
  if (!/^\d{4,8}$/.test(input.code.trim())) throw new Error("Enter the Telegram login code.");
  const connection = await ownedConnection(ctx, input.connectionId);
  if (!connection.pending_session || !connection.pending_phone || !connection.phone_code_hash) {
    throw new Error("This session is not waiting for a login code.");
  }
  const phone = decryptSecret(connection.pending_phone);
  const client = clientFromSession(decryptSecret(connection.pending_session));
  await client.connect();
  try {
    const result = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: phone,
        phoneCodeHash: String(connection.phone_code_hash),
        phoneCode: input.code.trim(),
      }),
    );
    if (result instanceof Api.auth.AuthorizationSignUpRequired) {
      throw new Error("This phone number is not registered with Telegram.");
    }
    return {
      connection: await saveConnectedProfile(
        ctx,
        input.connectionId,
        client,
        result.user as Api.User,
      ),
      step: "CONNECTED" as const,
    };
  } catch (error) {
    if (errorCode(error) === "SESSION_PASSWORD_NEEDED") {
      await db()
        .from("telegram_connections")
        .update({
          pending_session: encryptSecret(savedSession(client)),
          auth_step: "PASSWORD",
          status: "TWO_FACTOR_REQUIRED",
          health: "REQUIRES_ACTION",
          error_message: "Telegram 2FA password is required.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.connectionId)
        .eq("tenant_id", ctx.tenantId);
      return { step: "PASSWORD" as const };
    }
    throw new Error(errorMessage(error));
  } finally {
    await client.disconnect();
  }
}

export async function completeUserSessionPassword(
  ctx: AuthContext,
  input: { connectionId: string; password: string },
) {
  if (!input.password) throw new Error("Enter the Telegram 2FA password.");
  const connection = await ownedConnection(ctx, input.connectionId);
  const pending = decryptSecret(connection.pending_session);
  if (!pending) throw new Error("This session is not waiting for 2FA.");
  const client = clientFromSession(pending);
  await client.connect();
  try {
    const user = (await client.signInWithPassword(credentials(), {
      password: async () => input.password,
      onError: async () => true,
    })) as Api.User;
    return {
      connection: await saveConnectedProfile(ctx, input.connectionId, client, user),
      step: "CONNECTED" as const,
    };
  } catch (error) {
    throw new Error(errorMessage(error));
  } finally {
    await client.disconnect();
  }
}

export async function checkUserSession(ctx: AuthContext, connectionId: string) {
  const connection = await ownedConnection(ctx, connectionId);
  const encrypted = decryptSecret(connection.encrypted_session);
  if (!encrypted) throw new Error("This Telegram session is not authorized.");
  const client = clientFromSession(encrypted);
  console.info("SESSION_CONNECT_START", { tenantId: ctx.tenantId, connectionId });
  await client.connect();
  try {
    const me = await client.getMe();
    console.info("SESSION_AUTHORIZED", {
      tenantId: ctx.tenantId,
      connectionId,
      telegramUserId: Number((me as Api.User).id),
    });
    const row = await saveConnectedProfile(ctx, connectionId, client, me);
    return { ok: true as const, connection: row };
  } catch (error) {
    const message = errorMessage(error);
    if (invalidSessionError(error)) {
      console.warn("SESSION_INVALID", { tenantId: ctx.tenantId, connectionId, reason: message });
      await db()
        .from("telegram_connections")
        .update({
          status: "ERROR",
          health: "REQUIRES_ACTION",
          restriction_status: "REQUIRES_ACTION",
          restriction_reason: message,
          error_message: message,
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", connectionId)
        .eq("tenant_id", ctx.tenantId);
    } else {
      console.warn("SESSION_CHECK_FAILED", { tenantId: ctx.tenantId, connectionId, reason: message });
      await db()
        .from("telegram_connections")
        .update({
          error_message: message,
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", connectionId)
        .eq("tenant_id", ctx.tenantId);
    }
    return { ok: false as const, error: message };
  } finally {
    await client.disconnect();
  }
}

export async function disconnectUserSession(ctx: AuthContext, connectionId: string) {
  await db()
    .from("telegram_connections")
    .update({
      encrypted_session: null,
      pending_session: null,
      pending_phone: null,
      phone_code_hash: null,
      auth_step: null,
      status: "DISCONNECTED",
      health: "DISCONNECTED",
      restriction_status: "NONE",
      restriction_reason: null,
      error_message: null,
      disconnected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
    .eq("tenant_id", ctx.tenantId);
}

export async function withAuthorizedUserClient<T>(
  tenantId: string,
  connectionId: string,
  fn: (client: TelegramClient, connection: ConnectionRow) => Promise<T>,
) {
  const { data: connection } = await db()
    .from("telegram_connections")
    .select("*")
    .eq("id", connectionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!connection) throw new Error("Telegram session not found.");
  const row = connection as ConnectionRow;
  const session = decryptSecret(row.encrypted_session);
  if (!session) throw new Error("Telegram session is not authorized.");
  if (["DISCONNECTED", "AUTH_CODE_SENT", "TWO_FACTOR_REQUIRED"].includes(row.status)) {
    throw new Error("Telegram session is not connected.");
  }
  if (row.cooldown_until && new Date(row.cooldown_until) > new Date()) {
    throw new Error("Telegram session is cooling down.");
  }
  console.info("SESSION_LOAD", { tenantId, connectionId });
  const client = clientFromSession(session);
  try {
    console.info("SESSION_CONNECT_START", { tenantId, connectionId });
    await client.connect();
    console.info("SESSION_CONNECT_OK", { tenantId, connectionId });
    const me = await client.getMe();
    console.info("SESSION_AUTHORIZED", {
      tenantId,
      connectionId,
      telegramUserId: Number((me as Api.User).id),
    });
    await db()
      .from("telegram_connections")
      .update({
        status: "CONNECTED",
        health: "HEALTHY",
        restriction_status: "NONE",
        error_message: null,
        last_active_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId)
      .eq("tenant_id", tenantId);
    return await fn(client, row);
  } catch (error) {
    if (invalidSessionError(error)) {
      const message = errorMessage(error);
      console.warn("SESSION_INVALID", { tenantId, connectionId, reason: message });
      await db()
        .from("telegram_connections")
        .update({
          status: "ERROR",
          health: "REQUIRES_ACTION",
          restriction_status: "REQUIRES_ACTION",
          restriction_reason: message,
          error_message: message,
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", connectionId)
        .eq("tenant_id", tenantId);
    }
    throw error;
  } finally {
    await client.disconnect();
  }
}

export async function resolvePublicGroupViaUserSession(
  tenantId: string,
  connectionId: string,
  username: string,
) {
  return withAuthorizedUserClient(tenantId, connectionId, async (client) => {
    const handle = username.replace(/^@/, "");
    const entity = await client.getEntity(handle);
    if (!(entity instanceof Api.Channel) && !(entity instanceof Api.Chat)) {
      throw new Error("That username is not a group, supergroup, or channel.");
    }
    const full =
      entity instanceof Api.Channel
        ? await client.invoke(new Api.channels.GetFullChannel({ channel: entity }))
        : null;
    const memberCount =
      full?.fullChat instanceof Api.ChannelFull
        ? Number(full.fullChat.participantsCount ?? 0)
        : null;
    return {
      title: "title" in entity ? String(entity.title) : handle,
      username: "username" in entity && entity.username ? String(entity.username) : handle,
      telegramGroupId: Number(entity.id),
      memberCount,
      accessHash: accessHash(entity),
      entityType: entityType(entity),
      canSendMessages: entity instanceof Api.Channel ? channelWritable(entity) : true,
    };
  });
}

export async function searchPublicGroupsViaUserSession(
  tenantId: string,
  connectionId: string,
  keywords: string[],
) {
  return withAuthorizedUserClient(tenantId, connectionId, async (client) => {
    const results: {
      title: string;
      username: string;
      telegramGroupId: number;
      memberCount: number | null;
      matchedKeywords: string[];
      accessHash: string | null;
      entityType: string;
      canSendMessages: boolean;
    }[] = [];
    const addChat = (chat: unknown, keyword: string) => {
      if (!(chat instanceof Api.Channel) && !(chat instanceof Api.Chat)) return;
      const username = "username" in chat && chat.username ? String(chat.username) : "";
      if (!username) return;
      const title = "title" in chat ? String(chat.title) : username;
      const exists = results.find((r) => r.username.toLowerCase() === username.toLowerCase());
      if (exists) {
        if (!exists.matchedKeywords.includes(keyword)) exists.matchedKeywords.push(keyword);
        return;
      }
      results.push({
        title,
        username,
        telegramGroupId: Number(chat.id),
        accessHash: accessHash(chat),
        entityType: entityType(chat),
        canSendMessages: chat instanceof Api.Channel ? channelWritable(chat) : true,
        memberCount:
          "participantsCount" in chat && chat.participantsCount
            ? Number(chat.participantsCount)
            : null,
        matchedKeywords: [keyword],
      });
    };

    for (const keyword of keywords.slice(0, 12)) {
      const search = await client.invoke(
        new Api.contacts.Search({
          q: keyword,
          limit: 50,
        }),
      );
      for (const chat of search.chats) addChat(chat, keyword);

      try {
        const global = await client.invoke(
          new Api.messages.SearchGlobal({
            groupsOnly: true,
            q: keyword,
            filter: new Api.InputMessagesFilterEmpty(),
            minDate: 0,
            maxDate: 0,
            offsetRate: 0,
            offsetPeer: new Api.InputPeerEmpty(),
            offsetId: 0,
            limit: 50,
          }),
        );
        for (const chat of "chats" in global ? global.chats : []) addChat(chat, keyword);
      } catch {
        // contacts.Search is the fallback when Telegram global search is unavailable.
      }
    }
    return results;
  });
}

export async function discoverAudienceViaUserSession(
  tenantId: string,
  connectionId: string,
  group: {
    username?: string | null;
    telegram_group_id?: number | null;
    access_hash?: string | null;
    entity_type?: string | null;
  },
) {
  return withAuthorizedUserClient(tenantId, connectionId, async (client) => {
    try {
      console.info("AUDIENCE_GROUP_START", {
        tenantId,
        connectionId,
        groupId: group.telegram_group_id ?? null,
        username: group.username ?? null,
      });
      const entity = group.username
        ? await client.getEntity(group.username.replace(/^@/, ""))
        : inputChannelFromStored({
            id: group.telegram_group_id ?? null,
            accessHash: group.access_hash ?? null,
          });
      if (!(entity instanceof Api.Channel) && !(entity instanceof Api.InputChannel)) {
        return {
          status: "NO_PARTICIPANTS_EXPOSED" as const,
          reason: "Telegram member enumeration is only available for eligible channels/supergroups.",
          users: [],
        };
      }
      const users: {
        telegramUserId: number;
        accessHash: string | null;
        username: string | null;
        displayName: string | null;
      }[] = [];
      const seen = new Set<number>();
      const limit = 100;
      let offset = 0;
      for (let page = 0; page < 20; page += 1) {
        const response = await client.invoke(
          new Api.channels.GetParticipants({
            channel: entity,
            filter: new Api.ChannelParticipantsSearch({ q: "" }),
            offset,
            limit,
            hash: bigInt(0),
          }),
        );
        if (!(response instanceof Api.channels.ChannelParticipants)) {
          return {
            status: "MEMBERS_NOT_EXPOSED" as const,
            reason: "Telegram did not expose members for this group.",
            users,
          };
        }
        const pageUsers = response.users.filter((u): u is Api.User => u instanceof Api.User);
        for (const user of pageUsers) {
          if (user.bot || user.deleted) continue;
          const id = Number(user.id);
          if (!Number.isFinite(id) || seen.has(id)) continue;
          seen.add(id);
          const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
          users.push({
            telegramUserId: id,
            accessHash: accessHash(user),
            username: user.username ?? null,
            displayName: displayName || user.username || String(id),
          });
        }
        if (pageUsers.length < limit) break;
        offset += limit;
      }
      console.info("AUDIENCE_GROUP_COMPLETE", {
        tenantId,
        connectionId,
        groupId: group.telegram_group_id ?? null,
        usersFound: users.length,
      });
      if (!users.length) {
        return {
          status: "NO_PARTICIPANTS_EXPOSED" as const,
          reason: "Telegram returned no visible participants for this session and group.",
          users,
        };
      }
      return { status: "FOUND" as const, reason: null, users };
    } catch (error) {
      const classified = classifyAudienceError(error);
      console.warn("AUDIENCE_GROUP_FAILED", {
        tenantId,
        connectionId,
        groupId: group.telegram_group_id ?? null,
        status: classified.status,
        reason: classified.reason,
      });
      return { ...classified, users: [] };
    }
  });
}

export async function importGroupsFromFolderViaUserSession(
  tenantId: string,
  connectionId: string,
  folderLink: string,
) {
  return withAuthorizedUserClient(tenantId, connectionId, async (client) => {
    const slug = folderLink.trim().match(/(?:t\.me\/addlist\/|addlist\/)([A-Za-z0-9_-]+)/)?.[1];
    if (!slug) throw new Error("Enter a valid Telegram folder link, for example https://t.me/addlist/...");
    const invite = await client.invoke(new Api.chatlists.CheckChatlistInvite({ slug }));
    const chats = "chats" in invite && Array.isArray(invite.chats) ? invite.chats : [];
    const results: {
      title: string;
      username: string;
      telegramGroupId: number;
      memberCount: number | null;
      accessHash: string | null;
      entityType: string;
      canSendMessages: boolean;
      writableStatus: string;
      status: string;
      reason?: string | null;
    }[] = [];
    for (const chat of chats) {
      if (!(chat instanceof Api.Channel) && !(chat instanceof Api.Chat)) continue;
      const username = "username" in chat && chat.username ? String(chat.username) : "";
      const title = "title" in chat ? String(chat.title) : username;
      if (!username) {
        results.push({
          title,
          username: "",
          telegramGroupId: Number(chat.id),
          accessHash: accessHash(chat),
          entityType: entityType(chat),
          canSendMessages: false,
          writableStatus: "INACCESSIBLE",
          status: "INACCESSIBLE",
          reason: "Folder entry has no public username/link this app can safely use.",
          memberCount:
            "participantsCount" in chat && chat.participantsCount
              ? Number(chat.participantsCount)
              : null,
        });
        continue;
      }
      const canSend = chat instanceof Api.Channel ? channelWritable(chat) : true;
      results.push({
        title,
        username,
        telegramGroupId: Number(chat.id),
        accessHash: accessHash(chat),
        entityType: entityType(chat),
        canSendMessages: canSend,
        writableStatus: canSend ? "WRITABLE" : "NOT_WRITABLE",
        status: canSend ? "VALID" : "NOT_WRITABLE",
        reason: canSend ? null : "Selected session cannot post messages to this folder entry.",
        memberCount:
          "participantsCount" in chat && chat.participantsCount
            ? Number(chat.participantsCount)
            : null,
      });
    }
    return results;
  });
}

export async function joinGroupViaUserSession(
  tenantId: string,
  connectionId: string,
  username: string,
) {
  return withAuthorizedUserClient(tenantId, connectionId, async (client) => {
    const handle = username.replace(/^@/, "");
    try {
      const entity = await client.getEntity(handle);
      if (entity instanceof Api.Channel) {
        await client.invoke(new Api.channels.JoinChannel({ channel: entity }));
      }
      return { status: "JOINED" as const };
    } catch (error) {
      const message = errorMessage(error);
      if (message.includes("INVITE") || message.includes("PRIVATE")) {
        return { status: "INVITE_REQUIRED" as const, error: message };
      }
      if (message.includes("USER_RESTRICTED") || message.includes("FORBIDDEN")) {
        return { status: "RESTRICTED" as const, error: message };
      }
      return { status: "FAILED" as const, error: message };
    }
  });
}

export async function sendViaUserSession(
  tenantId: string,
  connectionId: string,
  target: string | number,
  message: MessagePayload,
) {
  return withAuthorizedUserClient(tenantId, connectionId, async (client) => {
    const text = [message.text ?? ""]
      .concat((message.buttons ?? []).map((button) => `${button.text}: ${button.url}`))
      .filter(Boolean)
      .join("\n\n");
    await client.sendMessage(target, {
      ...(text ? { message: text } : {}),
      ...(message.media_url ? { file: message.media_url } : {}),
      linkPreview: true,
    });
    await db()
      .from("telegram_connections")
      .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", connectionId)
      .eq("tenant_id", tenantId);
  });
}

export async function sendGroupViaUserSession(
  tenantId: string,
  connectionId: string,
  target: {
    telegramGroupId?: number | null;
    username?: string | null;
    accessHash?: string | null;
    entityType?: string | null;
  },
  message: MessagePayload,
) {
  return withAuthorizedUserClient(tenantId, connectionId, async (client) => {
    const entity = await resolveSendEntity(client, {
      id: target.telegramGroupId ?? null,
      username: target.username ?? null,
      accessHash: target.accessHash ?? null,
      entityType: target.entityType ?? null,
    });
    if (entity instanceof Api.Channel && !channelWritable(entity)) {
      throw new Error("NOT_WRITABLE: selected Telegram session cannot post to this group/channel.");
    }
    const text = [message.text ?? ""]
      .concat((message.buttons ?? []).map((button) => `${button.text}: ${button.url}`))
      .filter(Boolean)
      .join("\n\n");
    await client.sendMessage(entity, {
      ...(text ? { message: text } : {}),
      ...(message.media_url ? { file: message.media_url } : {}),
      linkPreview: true,
    });
    await db()
      .from("telegram_connections")
      .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", connectionId)
      .eq("tenant_id", tenantId);
  });
}

export async function sendDirectViaUserSession(
  tenantId: string,
  connectionId: string,
  target: { telegramUserId: number; username?: string | null; accessHash?: string | null },
  message: MessagePayload,
) {
  return withAuthorizedUserClient(tenantId, connectionId, async (client) => {
    const entity = await resolveSendEntity(client, {
      id: target.telegramUserId,
      username: target.username ?? null,
      accessHash: target.accessHash ?? null,
      entityType: "USER",
    });
    const text = [message.text ?? ""]
      .concat((message.buttons ?? []).map((button) => `${button.text}: ${button.url}`))
      .filter(Boolean)
      .join("\n\n");
    await client.sendMessage(entity, {
      ...(text ? { message: text } : {}),
      ...(message.media_url ? { file: message.media_url } : {}),
      linkPreview: true,
    });
    await db()
      .from("telegram_connections")
      .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", connectionId)
      .eq("tenant_id", tenantId);
  });
}
