import { TelegramClient } from "telegram";
import { Api } from "telegram/tl";
import { StringSession } from "telegram/sessions";
import bigInt from "big-integer";
import type { AuthContext } from "./customer-auth.server";
import { db, logSystem } from "./db.server";
import { assertEntitlement } from "./entitlements.server";
import { decryptSecret, encryptSecret } from "./security.server";
import { classifyTelegramError, telegramErrorMessage } from "./telegram-errors.server";
import { recordSessionHealthEvidence } from "./telegram-session-health.server";
import type { MessagePayload } from "./telegram.server";
import { entityDiagnostics, normalizeMessageEntities, utf16Length } from "./message-entities";

const CONNECTION_RETRIES = 3;
const sessionLocks = new Map<string, Promise<void>>();
const PREVIEW_CACHE_TTL_MS = 10 * 60_000;
const PREVIEW_BATCH_CONCURRENCY = 6;
const PERSISTENT_PREVIEW_CACHE_TTL_MS = 7 * 86400_000;
const CATALOG_CACHE_STALE_MS = 30 * 60_000;
const CATALOG_CACHE_EXPIRES_MS = 7 * 86400_000;
const previewCache = new Map<string, { expiresAt: number; value: CustomEmojiPreview }>();
type ConnectionRow = {
  id: string;
  tenant_id: string;
  label: string;
  account_name?: string | null;
  encrypted_session?: string | null;
  pending_session?: string | null;
  pending_phone?: string | null;
  phone_code_hash?: string | null;
  phone_masked?: string | null;
  status: string;
  cooldown_until?: string | null;
  health?: string | null;
  health_score?: number | null;
  health_summary?: string | null;
  telegram_premium?: boolean | null;
  telegram_premium_checked_at?: string | null;
  session_error_code?: string | null;
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
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: CONNECTION_RETRIES,
  });
  // Server operations are request/response only. GramJS starts a background
  // update loop on connect by default, which kept logging TIMEOUTs after jobs.
  (client as unknown as { _loopStarted?: boolean })._loopStarted = true;
  return client;
}

function savedSession(client: TelegramClient) {
  return (client.session as StringSession).save();
}

async function disconnectClient(
  client: TelegramClient,
  context: { tenantId?: string | null; connectionId?: string | null } = {},
) {
  try {
    await client.disconnect();
  } catch (error) {
    console.warn("SESSION_DISCONNECT_IGNORED", {
      tenantId: context.tenantId ?? null,
      connectionId: context.connectionId ?? null,
      reason: errorMessage(error),
    });
  }
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
  return telegramErrorMessage(error);
}

type StoredMessageEntity = NonNullable<MessagePayload["entities"]>[number] & { premium_required?: boolean };
export type CustomEmojiItem = {
  document_id: string;
  access_hash?: string | null;
  file_reference?: string | null;
  fallback: string;
  premium_required: boolean;
  free: boolean;
  mime_type?: string | null;
  preview_format?: "image" | "tgs" | "webm" | "unknown" | null;
  preview_url?: string | null;
  preview_unavailable?: boolean;
  set_title?: string | null;
  set_short_name?: string | null;
  set_id?: string | null;
  source: "recent" | "installed" | "featured" | "search" | "category";
};

export type CustomEmojiPack = {
  id: string;
  title: string;
  short_name?: string | null;
  source: CustomEmojiItem["source"];
  items: CustomEmojiItem[];
};

export type CustomEmojiCatalog = {
  sessionPremium: boolean;
  previewConnectionId?: string | null;
  recent: CustomEmojiItem[];
  installed: CustomEmojiItem[];
  featured: CustomEmojiItem[];
  search: CustomEmojiItem[];
  installedPacks: CustomEmojiPack[];
  featuredPacks: CustomEmojiPack[];
  searchPacks: CustomEmojiPack[];
  categories: { title: string; icon_document_id?: string | null; emoticons: string[] }[];
};

export type CustomEmojiPreview = {
  document_id: string;
  mime_type: string;
  format: "image" | "tgs" | "webm" | "unknown";
  data_url: string;
  fallback: string;
};

export type TelegramSentEntitySummary = {
  type: string;
  offset?: number;
  length?: number;
  document_id?: string;
  has_url?: boolean;
};

export type TelegramSendResult = {
  messageId: number | null;
  date: string | null;
  entities: TelegramSentEntitySummary[];
};

export type TelegramVerifiedSendResult = {
  sent: TelegramSendResult;
  refetched: TelegramSendResult | null;
};

function catalogCacheKey(tenantId: string, connectionId: string, tab: string, query: string) {
  return [tenantId, connectionId, tab, query.trim().toLowerCase()].join(":");
}

async function readCatalogCache(cacheKey: string) {
  const { data, error } = await db()
    .from("custom_emoji_catalog_cache")
    .select("catalog,stale_at,expires_at")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) {
    console.warn("CUSTOM_EMOJI_CATALOG_CACHE_ERROR", { stage: "read", error: errorMessage(error) });
    return null;
  }
  if (!data?.catalog) return null;
  return {
    catalog: data.catalog as CustomEmojiCatalog,
    stale: data.stale_at ? new Date(data.stale_at as string) <= new Date() : true,
  };
}

async function writeCatalogCache(input: {
  tenantId: string;
  connectionId: string;
  tab: string;
  query: string;
  catalog: CustomEmojiCatalog;
}) {
  const now = Date.now();
  const { error } = await db()
    .from("custom_emoji_catalog_cache")
    .upsert({
      cache_key: catalogCacheKey(input.tenantId, input.connectionId, input.tab, input.query),
      tenant_id: input.tenantId,
      connection_id: input.connectionId,
      tab: input.tab,
      query: input.query,
      catalog: input.catalog,
      updated_at: new Date(now).toISOString(),
      stale_at: new Date(now + CATALOG_CACHE_STALE_MS).toISOString(),
      expires_at: new Date(now + CATALOG_CACHE_EXPIRES_MS).toISOString(),
    }, { onConflict: "cache_key" });
  if (error) console.warn("CUSTOM_EMOJI_CATALOG_CACHE_ERROR", { stage: "write", error: errorMessage(error) });
}

async function withSessionLock<T>(tenantId: string, connectionId: string, fn: () => Promise<T>) {
  const key = `${tenantId}:${connectionId}`;
  const previous = sessionLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = previous.catch(() => undefined).then(() => new Promise<void>((resolve) => {
    release = resolve;
  }));
  sessionLocks.set(key, current);
  await previous.catch(() => undefined);
  console.info("SESSION_LOCK_ACQUIRED", { tenantId, connectionId });
  try {
    return await fn();
  } finally {
    release();
    if (sessionLocks.get(key) === current) sessionLocks.delete(key);
    console.info("SESSION_LOCK_RELEASED", { tenantId, connectionId });
  }
}

function sendText(message: MessagePayload) {
  return [message.text ?? ""]
    .concat((message.buttons ?? []).map((button) => `${button.text}: ${button.url}`))
    .filter(Boolean)
    .join("\n\n");
}

function buildFormattingEntities(message: MessagePayload) {
  const entities = normalizeMessageEntities(message.entities ?? [], message.text ?? "");
  return entities.map((entity: StoredMessageEntity) => {
    const base = { offset: entity.offset, length: entity.length };
    if (entity.type === "custom_emoji") {
      if (!entity.document_id) throw new Error("This custom emoji is no longer available.");
      return new Api.MessageEntityCustomEmoji({ ...base, documentId: bigInt(String(entity.document_id)) });
    }
    if (entity.type === "bold") return new Api.MessageEntityBold(base);
    if (entity.type === "italic") return new Api.MessageEntityItalic(base);
    if (entity.type === "underline") return new Api.MessageEntityUnderline(base);
    if (entity.type === "strikethrough") return new Api.MessageEntityStrike(base);
    if (entity.type === "spoiler") return new Api.MessageEntitySpoiler(base);
    if (entity.type === "text_url" && entity.url) return new Api.MessageEntityTextUrl({ ...base, url: entity.url });
    return null;
  }).filter(Boolean) as Api.TypeMessageEntity[];
}

function logOutgoingEntities(scope: string, tenantId: string, connectionId: string, message: MessagePayload) {
  const entities = normalizeMessageEntities(message.entities ?? [], message.text ?? "");
  console.info("TELEGRAM_SEND_ENTITIES", {
    scope,
    tenant_id: tenantId,
    connection_id: connectionId,
    text_utf16_length: (message.text ?? "").length,
    entities: entityDiagnostics(entities),
  });
}

function sentEntitySummary(entity: Api.TypeMessageEntity): TelegramSentEntitySummary {
  const value = entity as Api.TypeMessageEntity & {
    offset?: number;
    length?: number;
    documentId?: { toString?: () => string } | string | number;
    url?: string;
  };
  const base = {
    offset: typeof value.offset === "number" ? value.offset : undefined,
    length: typeof value.length === "number" ? value.length : undefined,
  };
  if (entity instanceof Api.MessageEntityCustomEmoji) {
    return { type: "custom_emoji", ...base, document_id: String(value.documentId) };
  }
  if (entity instanceof Api.MessageEntityBold) return { type: "bold", ...base };
  if (entity instanceof Api.MessageEntityItalic) return { type: "italic", ...base };
  if (entity instanceof Api.MessageEntityUnderline) return { type: "underline", ...base };
  if (entity instanceof Api.MessageEntityStrike) return { type: "strikethrough", ...base };
  if (entity instanceof Api.MessageEntitySpoiler) return { type: "spoiler", ...base };
  if (entity instanceof Api.MessageEntityTextUrl) return { type: "text_url", ...base, has_url: Boolean(value.url) };
  const named = entity as unknown as { className?: string; constructor?: { name?: string } };
  return { type: named.className ?? named.constructor?.name ?? "MessageEntity", ...base };
}

function summarizeSentMessage(sent: unknown): TelegramSendResult {
  const message = sent instanceof Api.Message ? sent : null;
  const raw = sent as { id?: number; date?: number; entities?: Api.TypeMessageEntity[] } | null;
  const id = message?.id ?? (typeof raw?.id === "number" ? raw.id : null);
  const dateValue = message?.date ?? (typeof raw?.date === "number" ? raw.date : null);
  const entities = (message?.entities ?? (Array.isArray(raw?.entities) ? raw?.entities : []) ?? [])
    .map((entity) => sentEntitySummary(entity));
  return {
    messageId: id,
    date: dateValue ? new Date(Number(dateValue) * 1000).toISOString() : null,
    entities,
  };
}

async function refetchSentMessage(client: TelegramClient, target: string | number, sent: TelegramSendResult) {
  if (!sent.messageId) return null;
  const messages = await client.getMessages(target, { ids: sent.messageId });
  const refetched = Array.isArray(messages) ? messages[0] : null;
  return refetched ? summarizeSentMessage(refetched) : null;
}

function logReturnedEntities(scope: string, tenantId: string, connectionId: string, result: TelegramSendResult) {
  console.info("TELEGRAM_SEND_RETURNED_ENTITIES", {
    scope,
    tenant_id: tenantId,
    connection_id: connectionId,
    message_id: result.messageId,
    entities: result.entities,
  });
}

function customEmojiAttribute(doc: Api.TypeDocument) {
  if (!(doc instanceof Api.Document)) return null;
  return doc.attributes.find((attr) => attr instanceof Api.DocumentAttributeCustomEmoji) as Api.DocumentAttributeCustomEmoji | undefined;
}

function userPremium(user: Api.User) {
  return (user as unknown as { premium?: boolean }).premium === true;
}

async function markInvalidAuth(tenantId: string, connectionId: string, message: string) {
  await db()
    .from("telegram_connections")
    .update({
      status: "ERROR",
      health: "RECONNECT_REQUIRED",
      health_score: 0,
      health_summary: "Telegram session expired. Reconnect this account.",
      restriction_status: "REQUIRES_ACTION",
      restriction_reason: message,
      error_message: "Telegram session expired. Reconnect this account.",
      session_error_code: "AUTH_KEY_UNREGISTERED",
      last_sync_at: new Date().toISOString(),
      health_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
    .eq("tenant_id", tenantId);
  await recordSessionHealthEvidence({
    tenantId,
    connectionId,
    evidence: "AUTH_FAILURE",
    reason: "Telegram session expired. Reconnect this account.",
    details: { code: "AUTH_KEY_UNREGISTERED" },
  });
}

function stickerSetMeta(set: unknown) {
  const value = set as { title?: string; shortName?: string; id?: unknown; accessHash?: unknown };
  return {
    title: typeof value?.title === "string" ? value.title : null,
    shortName: typeof value?.shortName === "string" ? value.shortName : null,
    id: value?.id == null ? null : String(value.id),
    accessHash: value?.accessHash == null ? null : String(value.accessHash),
  };
}

function emojiItem(doc: Api.TypeDocument, source: CustomEmojiItem["source"], set?: unknown): CustomEmojiItem | null {
  if (!(doc instanceof Api.Document)) return null;
  const attr = customEmojiAttribute(doc);
  if (!attr) return null;
  const meta = stickerSetMeta(set);
  return {
    document_id: String(doc.id),
    access_hash: String(doc.accessHash),
    file_reference: Buffer.from(doc.fileReference ?? Buffer.alloc(0)).toString("base64"),
    fallback: attr.alt || "⭐",
    free: attr.free === true,
    premium_required: attr.free !== true,
    mime_type: doc.mimeType ?? null,
    preview_format: emojiPreviewFormat(doc.mimeType ?? null),
    preview_url: null,
    preview_unavailable: false,
    set_title: meta.title,
    set_short_name: meta.shortName,
    set_id: meta.id,
    source,
  };
}

function uniqueEmoji(items: CustomEmojiItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.document_id)) return false;
    seen.add(item.document_id);
    return true;
  });
}

async function stickerSetDocuments(client: TelegramClient, set: unknown, source: CustomEmojiItem["source"], limit = 48) {
  const meta = stickerSetMeta(set);
  if (!meta.id || !meta.accessHash) return [];
  const full = await client.invoke(new Api.messages.GetStickerSet({
    stickerset: new Api.InputStickerSetID({ id: bigInt(meta.id), accessHash: bigInt(meta.accessHash) }),
    hash: 0,
  }));
  if (!(full instanceof Api.messages.StickerSet)) return [];
  return uniqueEmoji(full.documents.slice(0, limit).map((doc) => emojiItem(doc, source, full.set)).filter(Boolean) as CustomEmojiItem[]);
}

async function emojiPacksFromSets(client: TelegramClient, sets: unknown[], source: CustomEmojiItem["source"], setLimit = 24, perSetLimit = 48) {
  const packs: CustomEmojiPack[] = [];
  for (const set of sets.slice(0, setLimit)) {
    try {
      const meta = stickerSetMeta(set);
      const items = await stickerSetDocuments(client, set, source, perSetLimit);
      if (items.length) {
        packs.push({
          id: meta.id ?? `${source}-${packs.length}`,
          title: meta.title ?? "Emoji pack",
          short_name: meta.shortName,
          source,
          items,
        });
      }
    } catch (error) {
      console.warn("CUSTOM_EMOJI_SET_LOAD_FAILED", { source, error: errorMessage(error) });
    }
  }
  return packs;
}

function flattenPacks(packs: CustomEmojiPack[], itemLimit = 360) {
  return uniqueEmoji(packs.flatMap((pack) => pack.items)).slice(0, itemLimit);
}

function cachedPreview(documentId: string) {
  const cached = previewCache.get(documentId);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    previewCache.delete(documentId);
    return null;
  }
  console.info("CUSTOM_EMOJI_CACHE_HIT", { document_id: documentId });
  return cached.value;
}

function storePreview(preview: CustomEmojiPreview) {
  previewCache.set(preview.document_id, {
    expiresAt: Date.now() + PREVIEW_CACHE_TTL_MS,
    value: preview,
  });
  return preview;
}

async function cachedPersistentPreviews(documentIds: string[]) {
  if (!documentIds.length) return new Map<string, CustomEmojiPreview>();
  const { data, error } = await db()
    .from("custom_emoji_preview_cache")
    .select("document_id,mime_type,preview_format,data_url,fallback,expires_at")
    .in("document_id", documentIds)
    .gt("expires_at", new Date().toISOString());
  if (error) {
    console.warn("CUSTOM_EMOJI_CACHE_ERROR", { stage: "read", error: errorMessage(error) });
    return new Map<string, CustomEmojiPreview>();
  }
  const out = new Map<string, CustomEmojiPreview>();
  for (const row of data ?? []) {
    const preview = storePreview({
      document_id: String(row.document_id),
      mime_type: String(row.mime_type),
      format: String(row.preview_format) as CustomEmojiPreview["format"],
      data_url: String(row.data_url),
      fallback: String(row.fallback ?? "*"),
    });
    console.info("CUSTOM_EMOJI_CACHE_HIT", { document_id: preview.document_id, persistent: true });
    out.set(preview.document_id, preview);
  }
  return out;
}

async function storePersistentPreview(preview: CustomEmojiPreview) {
  const expiresAt = new Date(Date.now() + PERSISTENT_PREVIEW_CACHE_TTL_MS).toISOString();
  const { error } = await db()
    .from("custom_emoji_preview_cache")
    .upsert({
      document_id: preview.document_id,
      media_identity: "telegram-document",
      mime_type: preview.mime_type,
      preview_format: preview.format,
      data_url: preview.data_url,
      fallback: preview.fallback || "*",
      byte_length: preview.data_url.length,
      updated_at: new Date().toISOString(),
      expires_at: expiresAt,
    }, { onConflict: "document_id" });
  if (error) console.warn("CUSTOM_EMOJI_CACHE_ERROR", { stage: "write", document_id: preview.document_id, error: errorMessage(error) });
}

async function downloadCustomEmojiPreview(client: TelegramClient, connectionId: string, documentId: string): Promise<CustomEmojiPreview> {
  const started = Date.now();
  console.info("CUSTOM_EMOJI_PREVIEW_REQUEST", { connection_id: connectionId, document_id: String(documentId) });
  const docs = await client.invoke(new Api.messages.GetCustomEmojiDocuments({
    documentId: [bigInt(String(documentId))],
  }));
  const doc = (docs ?? []).find((item) => item instanceof Api.Document && String(item.id) === String(documentId)) as Api.Document | undefined;
  if (!doc) throw new Error("This custom emoji is no longer available.");
  const attr = customEmojiAttribute(doc);
  const downloaded = await client.downloadMedia(doc as never, {});
  if (!Buffer.isBuffer(downloaded)) throw new Error("Telegram custom emoji preview could not be downloaded.");
  const mime = doc.mimeType || "application/octet-stream";
  const format = emojiPreviewFormat(mime);
  console.info("CUSTOM_EMOJI_PREVIEW_RESULT", {
    connection_id: connectionId,
    document_id: String(doc.id),
    mime_type: mime,
    preview_format: format,
    bytes: downloaded.length,
  });
  console.info("CUSTOM_EMOJI_PREVIEW_MS", { connection_id: connectionId, document_id: String(doc.id), ms: Date.now() - started });
  const preview = storePreview({
    document_id: String(doc.id),
    mime_type: mime,
    format,
    data_url: `data:${mime};base64,${downloaded.toString("base64")}`,
    fallback: attr?.alt || "*",
  });
  void storePersistentPreview(preview);
  return preview;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

async function validateCustomEmojiEntities(client: TelegramClient, message: MessagePayload) {
  const custom = (message.entities ?? []).filter((entity): entity is StoredMessageEntity =>
    entity.type === "custom_emoji" && Boolean(entity.document_id),
  );
  if (!custom.length) return;
  const textLength = utf16Length(message.text ?? "");
  for (const entity of custom) {
    if (entity.offset < 0 || entity.length <= 0 || entity.offset + entity.length > textLength) {
      throw new Error("Custom emoji entity offset is invalid.");
    }
  }
  const ids = [...new Set(custom.map((entity) => String(entity.document_id)))];
  const docs = await client.invoke(new Api.messages.GetCustomEmojiDocuments({
    documentId: ids.map((id) => bigInt(id)),
  }));
  const found = new Set((docs ?? []).map((doc) => String((doc as Api.Document).id)));
  for (const id of ids) {
    if (!found.has(id)) throw new Error("This custom emoji is no longer available.");
  }
  const user = (await client.getMe()) as Api.User & { premium?: boolean };
  if (custom.some((entity) => entity.premium_required === true) && !user.premium) {
    throw new Error("This linked Telegram account requires Telegram Premium to send this custom emoji.");
  }
}

export async function listCustomEmojiCatalogViaUserSession(
  tenantId: string,
  connectionId: string,
  options: { query?: string | null; tab?: string | null } = {},
): Promise<CustomEmojiCatalog> {
  const started = Date.now();
  const query = options.query?.trim() ?? "";
  const tab = query ? "search" : (options.tab ?? "recent");
  const cacheKey = catalogCacheKey(tenantId, connectionId, tab, query);
  const cached = await readCatalogCache(cacheKey);
  if (cached) {
    console.info("CUSTOM_EMOJI_CATALOG_CACHE_HIT", {
      connection_id: connectionId,
      tab,
      query: Boolean(query),
      stale: cached.stale,
      ms: Date.now() - started,
    });
    if (cached.stale) {
      void refreshCustomEmojiCatalogCache(tenantId, connectionId, tab, query);
    }
    return cached.catalog;
  }
  console.info("CUSTOM_EMOJI_CATALOG_CACHE_MISS", { connection_id: connectionId, tab, query: Boolean(query) });
  const catalog = await loadCustomEmojiCatalogFromTelegram(tenantId, connectionId, tab, query, started);
  await writeCatalogCache({ tenantId, connectionId, tab, query, catalog });
  return catalog;
}

async function refreshCustomEmojiCatalogCache(tenantId: string, connectionId: string, tab: string, query: string) {
  const started = Date.now();
  try {
    const catalog = await loadCustomEmojiCatalogFromTelegram(tenantId, connectionId, tab, query, started);
    await writeCatalogCache({ tenantId, connectionId, tab, query, catalog });
    console.info("CUSTOM_EMOJI_CATALOG_REFRESH_MS", { connection_id: connectionId, tab, query: Boolean(query), ms: Date.now() - started });
  } catch (error) {
    console.warn("CUSTOM_EMOJI_CATALOG_REFRESH_FAILED", { connection_id: connectionId, tab, query: Boolean(query), error: errorMessage(error) });
  }
}

async function loadCustomEmojiCatalogFromTelegram(
  tenantId: string,
  connectionId: string,
  tab: string,
  query: string,
  started = Date.now(),
): Promise<CustomEmojiCatalog> {
  return withAuthorizedUserClient(tenantId, connectionId, async (client) => {
    const me = (await client.getMe()) as Api.User & { premium?: boolean };
    const catalog: CustomEmojiCatalog = {
      sessionPremium: me.premium === true,
      previewConnectionId: connectionId,
      recent: [],
      installed: [],
      featured: [],
      search: [],
      installedPacks: [],
      featuredPacks: [],
      searchPacks: [],
      categories: [],
    };
    if (tab === "recent") {
      try {
        const recent = await client.invoke(new Api.messages.GetRecentStickers({ attached: true, hash: bigInt(0) }));
        if (recent instanceof Api.messages.RecentStickers) {
          catalog.recent = uniqueEmoji(recent.stickers.map((doc) => emojiItem(doc, "recent")).filter(Boolean) as CustomEmojiItem[]).slice(0, 36);
        }
      } catch (error) {
        console.warn("CUSTOM_EMOJI_RECENT_FAILED", { error: errorMessage(error) });
      }
    }
    if (tab === "installed") {
      try {
        const installed = await client.invoke(new Api.messages.GetEmojiStickers({ hash: bigInt(0) }));
        if (installed instanceof Api.messages.AllStickers) {
          catalog.installedPacks = await emojiPacksFromSets(client, installed.sets, "installed", 24, 48);
          catalog.installed = flattenPacks(catalog.installedPacks);
        }
      } catch (error) {
        console.warn("CUSTOM_EMOJI_INSTALLED_FAILED", { error: errorMessage(error) });
      }
    }
    if (tab === "featured") {
      try {
        const featured = await client.invoke(new Api.messages.GetFeaturedEmojiStickers({ hash: bigInt(0) }));
        if (featured instanceof Api.messages.FeaturedStickers) {
          const sets = featured.sets.map((entry) => (entry as { set?: unknown }).set).filter(Boolean);
          catalog.featuredPacks = await emojiPacksFromSets(client, sets, "featured", 24, 48);
          catalog.featured = flattenPacks(catalog.featuredPacks);
        }
      } catch (error) {
        console.warn("CUSTOM_EMOJI_FEATURED_FAILED", { error: errorMessage(error) });
      }
    }
    if (tab === "search" && query) {
      try {
        const found = await client.invoke(new Api.messages.SearchEmojiStickerSets({
          q: query,
          excludeFeatured: false,
          hash: bigInt(0),
        }));
        if (found instanceof Api.messages.FoundStickerSets) {
          const sets = found.sets.map((entry) => (entry as { set?: unknown }).set).filter(Boolean);
          catalog.searchPacks = await emojiPacksFromSets(client, sets, "search", 24, 48);
          catalog.search = flattenPacks(catalog.searchPacks);
        }
      } catch (error) {
        console.warn("CUSTOM_EMOJI_SEARCH_FAILED", { error: errorMessage(error) });
      }
    }
    if (tab === "categories") {
      try {
        const groups = await client.invoke(new Api.messages.GetEmojiGroups({ hash: 0 }));
        if (groups instanceof Api.messages.EmojiGroups) {
          catalog.categories = groups.groups.map((group) => ({
            title: (group as { title?: string }).title ?? "Emoji",
            icon_document_id: (group as { iconEmojiId?: unknown }).iconEmojiId == null ? null : String((group as { iconEmojiId?: unknown }).iconEmojiId),
            emoticons: Array.isArray((group as { emoticons?: string[] }).emoticons) ? ((group as { emoticons?: string[] }).emoticons ?? []) : [],
          }));
        }
      } catch (error) {
        console.warn("CUSTOM_EMOJI_GROUPS_FAILED", { error: errorMessage(error) });
      }
    }
    console.info("CUSTOM_EMOJI_CATALOG_MS", {
      connection_id: connectionId,
      tab,
      query: Boolean(query),
      recent: catalog.recent.length,
      installed_packs: catalog.installedPacks.length,
      featured_packs: catalog.featuredPacks.length,
      search_packs: catalog.searchPacks.length,
      ms: Date.now() - started,
    });
    return catalog;
  });
}

export async function customEmojiPreviewViaUserSession(
  tenantId: string,
  connectionId: string,
  documentId: string,
): Promise<CustomEmojiPreview> {
  const cached = cachedPreview(String(documentId));
  if (cached) return cached;
  const persistent = await cachedPersistentPreviews([String(documentId)]);
  const persisted = persistent.get(String(documentId));
  if (persisted) return persisted;
  try {
    return await withAuthorizedUserClient(tenantId, connectionId, async (client) => {
      console.info("CUSTOM_EMOJI_PREVIEW_REQUEST", { connection_id: connectionId, document_id: String(documentId) });
      const docs = await client.invoke(new Api.messages.GetCustomEmojiDocuments({
        documentId: [bigInt(String(documentId))],
      }));
      const doc = (docs ?? []).find((item) => item instanceof Api.Document && String(item.id) === String(documentId)) as Api.Document | undefined;
      if (!doc) throw new Error("This custom emoji is no longer available.");
      const attr = customEmojiAttribute(doc);
      const downloaded = await client.downloadMedia(doc as never, {});
      if (!Buffer.isBuffer(downloaded)) throw new Error("Telegram custom emoji preview could not be downloaded.");
      const mime = doc.mimeType || "application/octet-stream";
      const format = emojiPreviewFormat(mime);
      console.info("CUSTOM_EMOJI_PREVIEW_RESULT", {
        connection_id: connectionId,
        document_id: String(doc.id),
        mime_type: mime,
        preview_format: format,
        bytes: downloaded.length,
      });
      return {
        document_id: String(doc.id),
        mime_type: mime,
        format,
        data_url: `data:${mime};base64,${downloaded.toString("base64")}`,
        fallback: attr?.alt || "⭐",
      };
    });
  } catch (error) {
    console.warn("CUSTOM_EMOJI_PREVIEW_ERROR", {
      connection_id: connectionId,
      document_id: String(documentId),
      error: errorMessage(error),
    });
    throw error;
  }
}

export async function customEmojiPreviewsViaUserSession(
  tenantId: string,
  connectionId: string,
  documentIds: string[],
): Promise<{ previews: CustomEmojiPreview[]; failed: { document_id: string; error: string }[] }> {
  const started = Date.now();
  const uniqueIds = [...new Set(documentIds.map(String).filter(Boolean))].slice(0, 72);
  const previews: CustomEmojiPreview[] = [];
  const failed: { document_id: string; error: string }[] = [];
  const missing: string[] = [];
  for (const id of uniqueIds) {
    const cached = cachedPreview(id);
    if (cached) previews.push(cached);
    else missing.push(id);
  }
  if (missing.length) {
    const persistent = await cachedPersistentPreviews(missing);
    for (const [id, preview] of persistent) previews.push(preview);
    for (let index = missing.length - 1; index >= 0; index -= 1) {
      if (persistent.has(missing[index]!)) missing.splice(index, 1);
    }
  }
  if (missing.length) {
    await withAuthorizedUserClient(tenantId, connectionId, async (client) => {
      const batch = await mapWithConcurrency(missing, PREVIEW_BATCH_CONCURRENCY, async (documentId) => {
        try {
          return { preview: await downloadCustomEmojiPreview(client, connectionId, documentId), error: null };
        } catch (error) {
          console.warn("CUSTOM_EMOJI_PREVIEW_ERROR", {
            connection_id: connectionId,
            document_id: String(documentId),
            error: errorMessage(error),
          });
          return { preview: null, error: { document_id: String(documentId), error: errorMessage(error) } };
        }
      });
      for (const result of batch) {
        if (result.preview) previews.push(result.preview);
        if (result.error) failed.push(result.error);
      }
    });
  }
  console.info("CUSTOM_EMOJI_FIRST_PAGE_MS", {
    connection_id: connectionId,
    requested: uniqueIds.length,
    fetched: missing.length,
    failed: failed.length,
    ms: Date.now() - started,
  });
  return { previews, failed };
}

function emojiPreviewFormat(mime?: string | null): "image" | "tgs" | "webm" | "unknown" {
  const normalized = String(mime ?? "").toLowerCase();
  if (normalized.includes("x-tgsticker") || normalized.includes("gzip")) return "tgs";
  if (normalized.includes("webm") || normalized.startsWith("video/")) return "webm";
  if (normalized.startsWith("image/")) return "image";
  return "unknown";
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

function userPresence(user: Api.User) {
  const status = user.status;
  if (status instanceof Api.UserStatusOnline) {
    return { presenceStatus: "ONLINE", lastSeenAt: null };
  }
  if (status instanceof Api.UserStatusRecently) {
    return { presenceStatus: "RECENTLY", lastSeenAt: null };
  }
  if (status instanceof Api.UserStatusLastWeek) {
    return { presenceStatus: "WITHIN_WEEK", lastSeenAt: null };
  }
  if (status instanceof Api.UserStatusLastMonth) {
    return { presenceStatus: "WITHIN_MONTH", lastSeenAt: null };
  }
  if (status instanceof Api.UserStatusOffline) {
    const value = status.wasOnline ? new Date(Number(status.wasOnline) * 1000) : null;
    const days = value ? (Date.now() - value.getTime()) / 86_400_000 : null;
    return {
      presenceStatus: days != null && days > 30 ? "LONG_AGO" : "WITHIN_MONTH",
      lastSeenAt: value?.toISOString() ?? null,
    };
  }
  return { presenceStatus: "UNKNOWN", lastSeenAt: null };
}

function channelWritable(entity: Api.Channel) {
  const row = entity as Api.Channel & {
    creator?: boolean;
    left?: boolean;
    adminRights?: { postMessages?: boolean } | null;
    bannedRights?: { sendMessages?: boolean } | null;
    defaultBannedRights?: { sendMessages?: boolean } | null;
  };
  if (row.left) return false;
  if (row.broadcast && !row.creator && !row.adminRights?.postMessages) return false;
  if (row.bannedRights?.sendMessages) return false;
  if (row.defaultBannedRights?.sendMessages) return false;
  return true;
}

function inspectWritableState(entity: Api.Channel | Api.Chat) {
  if (entity instanceof Api.Chat) {
    return {
      writableStatus: "WRITABLE" as const,
      canSendMessages: true,
      reason: "Basic chat is accessible to this session.",
    };
  }
  const row = entity as Api.Channel & {
    creator?: boolean;
    left?: boolean;
    broadcast?: boolean;
    megagroup?: boolean;
    adminRights?: { postMessages?: boolean } | null;
    bannedRights?: { sendMessages?: boolean } | null;
    defaultBannedRights?: { sendMessages?: boolean } | null;
  };
  if (row.left) {
    return {
      writableStatus: "JOIN_REQUIRED" as const,
      canSendMessages: null,
      reason: "This session has not joined the group.",
    };
  }
  if (row.broadcast && !row.creator && !row.adminRights?.postMessages) {
    return {
      writableStatus: "NOT_WRITABLE" as const,
      canSendMessages: false,
      reason: "Only admins may post in this channel.",
    };
  }
  if (row.bannedRights?.sendMessages) {
    return {
      writableStatus: "NOT_WRITABLE" as const,
      canSendMessages: false,
      reason: "Posting is disabled for this session.",
    };
  }
  if (row.defaultBannedRights?.sendMessages) {
    return {
      writableStatus: "NOT_WRITABLE" as const,
      canSendMessages: false,
      reason: "Posting is disabled by default group permissions.",
    };
  }
  return {
    writableStatus: "WRITABLE" as const,
    canSendMessages: true,
    reason: "Telegram permissions indicate this session can write.",
  };
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
  return "id, tenant_id, label, account_name, username, telegram_id, telegram_user_id, phone_masked, status, health, health_score, health_updated_at, health_summary, telegram_premium, telegram_premium_checked_at, session_error_code, error_message, restriction_status, restriction_reason, last_active_at, last_used_at, last_sync_at, cooldown_until, auth_step, created_at, updated_at";
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
  await assertEntitlement(ctx.tenantId, "max_connections", count ?? 0, 1);
}

async function saveConnectedProfile(
  ctx: AuthContext,
  connectionId: string,
  client: TelegramClient,
  user: Api.User,
  phone?: string | null,
) {
  const session = savedSession(client);
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const patch: Record<string, unknown> = {
    encrypted_session: encryptSecret(session),
      pending_session: null,
      phone_code_hash: null,
      auth_step: null,
      telegram_id: Number(user.id),
      telegram_user_id: Number(user.id),
      username: user.username ?? null,
      account_name: fullName || user.username || "Telegram account",
      status: "CONNECTED",
      health: "HEALTHY",
      health_score: 90,
      health_updated_at: new Date().toISOString(),
      health_summary: "Healthy - authorization valid",
      telegram_premium: userPremium(user),
      telegram_premium_checked_at: new Date().toISOString(),
      session_error_code: null,
      restriction_status: "NONE",
      restriction_reason: null,
      error_message: null,
      last_active_at: new Date().toISOString(),
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
  };
  if (phone) {
    patch.pending_phone = encryptSecret(phone);
    patch.phone_masked = maskPhone(phone);
  }
  const { data, error } = await db()
    .from("telegram_connections")
    .update(patch)
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
  input: { label: string; phone: string; connectionId?: string | null },
) {
  if (input.connectionId) {
    return withSessionLock(ctx.tenantId, input.connectionId, () => startUserSessionLoginUnlocked(ctx, input));
  }
  return startUserSessionLoginUnlocked(ctx, input);
}

async function startUserSessionLoginUnlocked(
  ctx: AuthContext,
  input: { label: string; phone: string; connectionId?: string | null },
) {
  const phone = normalizePhone(input.phone);
  const masked = maskPhone(phone);
  const clientDb = db();
  const targetId = input.connectionId ?? null;
  let duplicateId: string | null = null;
  if (targetId) {
    await ownedConnection(ctx, targetId);
    const { data: sameMasked } = await clientDb
      .from("telegram_connections")
      .select("id, pending_phone")
      .eq("tenant_id", ctx.tenantId)
      .eq("phone_masked", masked)
      .neq("id", targetId);
    for (const row of sameMasked ?? []) {
      if (decryptSecret(row.pending_phone) === phone) duplicateId = String(row.id);
    }
  } else {
    await ensureLimit(ctx);
    const { data: existingRows } = await clientDb
      .from("telegram_connections")
      .select("id, pending_phone, phone_masked")
      .eq("tenant_id", ctx.tenantId)
      .eq("phone_masked", masked)
      .limit(20);
    for (const row of existingRows ?? []) {
      const storedPhone = decryptSecret(row.pending_phone);
      if (storedPhone === phone || (!storedPhone && row.phone_masked === masked)) {
        throw new Error("This Telegram account already exists. Use Reconnect.");
      }
    }
  }
  const client = clientFromSession("");
  await client.connect();
  try {
    const sent = await client.sendCode(credentials(), phone);
    const pendingSession = savedSession(client);
    const patch = {
        tenant_id: ctx.tenantId,
        label: input.label.trim() || "Telegram account",
        phone_masked: masked,
        pending_phone: encryptSecret(phone),
        pending_session: encryptSecret(pendingSession),
        phone_code_hash: sent.phoneCodeHash,
        auth_step: "CODE",
        status: "AUTH_CODE_SENT",
        health: "REQUIRES_CODE",
        restriction_status: "NONE",
        error_message: null,
        updated_at: new Date().toISOString(),
      };
    const query = targetId
      ? clientDb
          .from("telegram_connections")
          .update({
            ...patch,
            encrypted_session: null,
            username: null,
            telegram_id: null,
            telegram_user_id: null,
            account_name: input.label.trim() || "Telegram account",
          })
          .eq("id", targetId)
          .eq("tenant_id", ctx.tenantId)
      : clientDb.from("telegram_connections").insert(patch);
    const { data, error } = await query
      .select(publicFields())
      .single();
    if (error) throw new Error(error.message);
    if (duplicateId) {
      await clientDb
        .from("telegram_connections")
        .delete()
        .eq("id", duplicateId)
        .eq("tenant_id", ctx.tenantId);
    }
    await logSystem({
      tenant_id: ctx.tenantId,
      customer_id: ctx.customerId,
      action: "MT_CODE_SENT",
    });
    return { connection: data, step: "CODE" as const, isCodeViaApp: sent.isCodeViaApp };
  } finally {
    await disconnectClient(client, { tenantId: ctx.tenantId, connectionId: targetId ?? null });
  }
}

export async function startUserSessionReconnect(
  ctx: AuthContext,
  input: { connectionId: string },
) {
  const connection = await ownedConnection(ctx, input.connectionId);
  let phone = decryptSecret(connection.pending_phone);
  if (!phone && connection.phone_masked) {
    const { data: sameMasked } = await db()
      .from("telegram_connections")
      .select("id, pending_phone")
      .eq("tenant_id", ctx.tenantId)
      .eq("phone_masked", connection.phone_masked)
      .neq("id", input.connectionId);
    for (const row of sameMasked ?? []) {
      const candidate = decryptSecret(row.pending_phone);
      if (candidate) {
        phone = candidate;
        break;
      }
    }
  }
  if (!phone) {
    throw new Error("Saved phone number is missing. Delete this session and add it again.");
  }
  return startUserSessionLogin(ctx, {
    label: String(connection.label ?? connection.account_name ?? "Telegram account"),
    phone,
    connectionId: input.connectionId,
  });
}

export async function completeUserSessionCode(
  ctx: AuthContext,
  input: { connectionId: string; code: string },
) {
  return withSessionLock(ctx.tenantId, input.connectionId, async () => {
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
        phone,
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
    await disconnectClient(client, { tenantId: ctx.tenantId, connectionId: input.connectionId });
  }
  });
}

export async function completeUserSessionPassword(
  ctx: AuthContext,
  input: { connectionId: string; password: string },
) {
  return withSessionLock(ctx.tenantId, input.connectionId, async () => {
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
      connection: await saveConnectedProfile(ctx, input.connectionId, client, user, decryptSecret(connection.pending_phone)),
      step: "CONNECTED" as const,
    };
  } catch (error) {
    throw new Error(errorMessage(error));
  } finally {
    await disconnectClient(client, { tenantId: ctx.tenantId, connectionId: input.connectionId });
  }
  });
}

export async function checkUserSession(ctx: AuthContext, connectionId: string) {
  return withSessionLock(ctx.tenantId, connectionId, async () => {
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
      await markInvalidAuth(ctx.tenantId, connectionId, message);
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
    await disconnectClient(client, { tenantId: ctx.tenantId, connectionId });
  }
  });
}

export async function disconnectUserSession(ctx: AuthContext, connectionId: string) {
  await db()
    .from("telegram_connections")
    .update({
      encrypted_session: null,
      pending_session: null,
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
  return withSessionLock(tenantId, connectionId, async () => {
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
        telegram_premium: userPremium(me as Api.User),
        telegram_premium_checked_at: new Date().toISOString(),
        session_error_code: null,
        restriction_status: "NONE",
        error_message: null,
        last_active_at: new Date().toISOString(),
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId)
      .eq("tenant_id", tenantId);
    await recordSessionHealthEvidence({
      tenantId,
      connectionId,
      evidence: "AUTH_OK",
      reason: "Healthy - authorization valid",
    });
    return await fn(client, row);
  } catch (error) {
    if (invalidSessionError(error)) {
      const message = errorMessage(error);
      console.warn("SESSION_INVALID", { tenantId, connectionId, reason: message });
      await markInvalidAuth(tenantId, connectionId, message);
    }
    throw error;
  } finally {
    await disconnectClient(client, { tenantId, connectionId });
  }
  });
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

export async function verifyGroupWritableViaUserSession(
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
      const seed = group.username
        ? await client.getEntity(group.username.replace(/^@/, ""))
        : inputChannelFromStored({
            id: group.telegram_group_id ?? null,
            accessHash: group.access_hash ?? null,
          });
      if (!seed) {
        return {
          title: null,
          username: group.username ?? null,
          telegramGroupId: group.telegram_group_id ?? null,
          accessHash: group.access_hash ?? null,
          entityType: group.entity_type ?? null,
          canSendMessages: null,
          writableStatus: "UNKNOWN",
          reason: "Group entity cannot be resolved without username or access hash.",
        };
      }
      const entity = await client.getEntity(seed as never);
      if (!(entity instanceof Api.Channel) && !(entity instanceof Api.Chat)) {
        return {
          title: null,
          username: group.username ?? null,
          telegramGroupId: group.telegram_group_id ?? null,
          accessHash: group.access_hash ?? null,
          entityType: group.entity_type ?? "UNKNOWN",
          canSendMessages: false,
          writableStatus: "INACCESSIBLE",
          reason: "Resolved entity is not a group or channel.",
        };
      }
      const writable = inspectWritableState(entity);
      await recordSessionHealthEvidence({
        tenantId,
        connectionId,
        evidence: "RESOLVE_OK",
        reason: "Group resolution successful",
      });
      return {
        title: "title" in entity ? String(entity.title) : null,
        username: "username" in entity && entity.username ? String(entity.username) : group.username ?? null,
        telegramGroupId: Number(entity.id),
        accessHash: accessHash(entity),
        entityType: entityType(entity),
        canSendMessages: writable.canSendMessages,
        writableStatus: writable.writableStatus,
        reason: writable.reason,
      };
    } catch (error) {
      const classified = classifyTelegramError(error);
      const upper = classified.raw.toUpperCase();
      const writableStatus = upper.includes("USER_NOT_PARTICIPANT")
        ? "JOIN_REQUIRED"
        : upper.includes("CHAT_WRITE_FORBIDDEN") ||
            upper.includes("CHAT_ADMIN_REQUIRED") ||
            upper.includes("CHAT_GUEST_SEND_FORBIDDEN") ||
            upper.includes("USER_BANNED_IN_CHANNEL") ||
            upper.includes("WRITE_FORBIDDEN") ||
            upper.includes("NOT ENOUGH RIGHTS")
          ? "NOT_WRITABLE"
          : upper.includes("CHANNEL_PRIVATE") ||
              upper.includes("CHAT_FORBIDDEN") ||
              upper.includes("PEER_ID_INVALID") ||
              upper.includes("ACCESS_HASH")
            ? "INACCESSIBLE"
            : "UNKNOWN";
      const evidence =
        classified.scope === "AUTH"
          ? "AUTH_FAILURE"
          : classified.scope === "RATE_LIMIT"
            ? "RATE_LIMIT"
            : classified.sessionLevel
              ? "SESSION_FAILURE"
              : classified.groupLevel
                ? "GROUP_FAILURE"
                : classified.scope === "TRANSIENT"
                  ? "TRANSIENT"
                  : null;
      if (evidence) {
        await recordSessionHealthEvidence({
          tenantId,
          connectionId,
          evidence,
          reason: classified.human,
          details: { raw: classified.raw, code: classified.code, scope: classified.scope },
        });
      }
      if (
        writableStatus === "NOT_WRITABLE" ||
        writableStatus === "JOIN_REQUIRED" ||
        writableStatus === "INACCESSIBLE"
      ) {
        return {
          title: null,
          username: group.username ?? null,
          telegramGroupId: group.telegram_group_id ?? null,
          accessHash: group.access_hash ?? null,
          entityType: group.entity_type ?? null,
          canSendMessages: writableStatus === "JOIN_REQUIRED" ? null : false,
          writableStatus,
          reason: classified.human,
          rawError: classified.raw,
          errorCode: classified.code,
          classification: classified.scope,
        };
      }
      return {
        title: null,
        username: group.username ?? null,
        telegramGroupId: group.telegram_group_id ?? null,
        accessHash: group.access_hash ?? null,
        entityType: group.entity_type ?? null,
        canSendMessages: null,
        writableStatus: "UNKNOWN",
        reason: classified.human,
        rawError: classified.raw,
        errorCode: classified.code,
        classification: classified.scope,
      };
    }
  });
}

export async function testGroupSendableViaUserSession(
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
      const seed = group.username
        ? await client.getEntity(group.username.replace(/^@/, ""))
        : inputChannelFromStored({
            id: group.telegram_group_id ?? null,
            accessHash: group.access_hash ?? null,
          });
      if (!seed) {
        return {
          sendableStatus: "UNKNOWN",
          canSendMessages: null,
          reason: "Group entity cannot be resolved without username or access hash.",
        };
      }
      const entity = await client.getEntity(seed as never);
      if (!(entity instanceof Api.Channel) && !(entity instanceof Api.Chat)) {
        return {
          sendableStatus: "INACCESSIBLE",
          canSendMessages: false,
          reason: "Resolved entity is not a group or channel.",
        };
      }
      const writable = inspectWritableState(entity);
      if (writable.writableStatus === "JOIN_REQUIRED") {
        return {
          sendableStatus: "JOIN_REQUIRED",
          canSendMessages: null,
          reason: writable.reason,
          title: "title" in entity ? String(entity.title) : null,
          username: "username" in entity && entity.username ? String(entity.username) : group.username ?? null,
          telegramGroupId: Number(entity.id),
          accessHash: accessHash(entity),
          entityType: entityType(entity),
        };
      }
      const sent = await client.sendMessage(entity, { message: "hey" });
      const sentId = sent && typeof sent === "object" && "id" in sent ? Number(sent.id) : null;
      let deleted = false;
      if (sentId) {
        try {
          if (entity instanceof Api.Channel) {
            await client.invoke(new Api.channels.DeleteMessages({ channel: entity, id: [sentId] }));
          } else {
            await client.invoke(new Api.messages.DeleteMessages({ id: [sentId], revoke: true }));
          }
          deleted = true;
        } catch {
          /* Best-effort cleanup only. A confirmed send still proves writability. */
        }
      }
      await recordSessionHealthEvidence({
        tenantId,
        connectionId,
        evidence: "SEND_OK",
        reason: "Sendable test message succeeded",
      });
      if (deleted) {
        await recordSessionHealthEvidence({
          tenantId,
          connectionId,
          evidence: "DELETE_OK",
          reason: "Sendable test message cleanup succeeded",
        });
      }
      return {
        sendableStatus: "SENDABLE",
        canSendMessages: true,
        reason: null,
        title: "title" in entity ? String(entity.title) : null,
        username: "username" in entity && entity.username ? String(entity.username) : group.username ?? null,
        telegramGroupId: Number(entity.id),
        accessHash: accessHash(entity),
        entityType: entityType(entity),
      };
    } catch (error) {
      const classified = classifyTelegramError(error);
      const upper = classified.raw.toUpperCase();
      const sendableStatus = upper.includes("USER_NOT_PARTICIPANT")
        ? "JOIN_REQUIRED"
        : upper.includes("CHANNEL_PRIVATE") ||
            upper.includes("CHAT_FORBIDDEN") ||
            upper.includes("PEER_ID_INVALID") ||
            upper.includes("ACCESS_HASH")
          ? "INACCESSIBLE"
          : classified.groupLevel
            ? "NOT_SENDABLE"
            : "UNKNOWN";
      const evidence =
        classified.scope === "AUTH"
          ? "AUTH_FAILURE"
          : classified.scope === "RATE_LIMIT"
            ? "RATE_LIMIT"
            : classified.sessionLevel
              ? "SESSION_FAILURE"
              : classified.groupLevel
                ? "GROUP_FAILURE"
                : classified.scope === "TRANSIENT"
                  ? "TRANSIENT"
                  : null;
      if (evidence) {
        await recordSessionHealthEvidence({
          tenantId,
          connectionId,
          evidence,
          reason: classified.human,
          details: { raw: classified.raw, code: classified.code, scope: classified.scope },
        });
      }
      return {
        sendableStatus,
        canSendMessages:
          sendableStatus === "UNKNOWN" || sendableStatus === "JOIN_REQUIRED" ? null : false,
        reason: classified.human,
        rawError: classified.raw,
        errorCode: classified.code,
        classification: classified.scope,
      };
    }
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
        presenceStatus: string;
        lastSeenAt: string | null;
        recentActivityAt: string | null;
        messagesObserved: number;
        activePoster: boolean;
      }[] = [];
      const seen = new Map<number, {
        telegramUserId: number;
        accessHash: string | null;
        username: string | null;
        displayName: string | null;
        presenceStatus: string;
        lastSeenAt: string | null;
        recentActivityAt: string | null;
        messagesObserved: number;
        activePoster: boolean;
      }>();
      const addUser = (
        user: Api.User,
        activity?: { recentActivityAt?: string | null; messagesObserved?: number },
      ) => {
        if (user.bot || user.deleted) return;
        const id = Number(user.id);
        if (!Number.isFinite(id)) return;
        const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
        const presence = userPresence(user);
        const existing = seen.get(id);
        if (existing) {
          existing.messagesObserved += activity?.messagesObserved ?? 0;
          existing.activePoster = existing.activePoster || !!activity?.messagesObserved;
          if (activity?.recentActivityAt) existing.recentActivityAt = activity.recentActivityAt;
          if (existing.presenceStatus === "UNKNOWN" && presence.presenceStatus !== "UNKNOWN") {
            existing.presenceStatus = presence.presenceStatus;
            existing.lastSeenAt = presence.lastSeenAt;
          }
          return;
        }
        seen.set(id, {
          telegramUserId: id,
          accessHash: accessHash(user),
          username: user.username ?? null,
          displayName: displayName || user.username || String(id),
          presenceStatus: presence.presenceStatus,
          lastSeenAt: presence.lastSeenAt,
          recentActivityAt: activity?.recentActivityAt ?? null,
          messagesObserved: activity?.messagesObserved ?? 0,
          activePoster: !!activity?.messagesObserved,
        });
      };
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
          addUser(user);
        }
        if (pageUsers.length < limit) break;
        offset += limit;
      }
      try {
        const history = await client.invoke(
          new Api.messages.GetHistory({
            peer: entity,
            offsetId: 0,
            offsetDate: 0,
            addOffset: 0,
            limit: 300,
            maxId: 0,
            minId: 0,
            hash: bigInt(0),
          }),
        );
        const historyUsers = new Map<number, Api.User>();
        for (const user of "users" in history ? history.users : []) {
          if (user instanceof Api.User) historyUsers.set(Number(user.id), user);
        }
        const activity = new Map<number, { count: number; recentActivityAt: string | null }>();
        for (const message of "messages" in history ? history.messages : []) {
          if (!(message instanceof Api.Message)) continue;
          const peer = message.fromId;
          if (!(peer instanceof Api.PeerUser)) continue;
          const id = Number(peer.userId);
          if (!Number.isFinite(id)) continue;
          const row = activity.get(id) ?? { count: 0, recentActivityAt: null };
          row.count += 1;
          const at = message.date ? new Date(Number(message.date) * 1000).toISOString() : null;
          if (at && (!row.recentActivityAt || at > row.recentActivityAt)) row.recentActivityAt = at;
          activity.set(id, row);
        }
        for (const [id, row] of activity) {
          const user = historyUsers.get(id);
          if (user) {
            addUser(user, {
              recentActivityAt: row.recentActivityAt,
              messagesObserved: row.count,
            });
          }
        }
      } catch (error) {
        console.warn("AUDIENCE_ACTIVITY_HISTORY_FAILED", {
          tenantId,
          connectionId,
          groupId: group.telegram_group_id ?? null,
          reason: errorMessage(error),
        });
      }
      users.push(...seen.values());
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
): Promise<TelegramSendResult> {
  return withAuthorizedUserClient(tenantId, connectionId, async (client) => {
    try {
      await validateCustomEmojiEntities(client, message);
      const text = sendText(message);
      logOutgoingEntities("direct_target", tenantId, connectionId, message);
      const sent = await client.sendMessage(target, {
        ...(text ? { message: text } : {}),
        ...(message.media_url ? { file: message.media_url } : {}),
        ...(message.entities?.length ? { formattingEntities: buildFormattingEntities(message) } : {}),
        linkPreview: true,
      });
      await recordSessionHealthEvidence({ tenantId, connectionId, evidence: "SEND_OK", reason: "Message sent successfully" });
      await db()
        .from("telegram_connections")
        .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", connectionId)
        .eq("tenant_id", tenantId);
      const result = summarizeSentMessage(sent);
      logReturnedEntities("direct_target", tenantId, connectionId, result);
      return result;
    } catch (error) {
      const classified = classifyTelegramError(error);
      await recordSessionHealthEvidence({
        tenantId,
        connectionId,
        evidence:
          classified.scope === "AUTH"
            ? "AUTH_FAILURE"
            : classified.scope === "RATE_LIMIT"
              ? "RATE_LIMIT"
              : classified.sessionLevel
                ? "SESSION_FAILURE"
                : classified.groupLevel
                  ? "GROUP_FAILURE"
                  : "TRANSIENT",
        reason: classified.human,
        details: { raw: classified.raw, code: classified.code, scope: classified.scope },
      });
      throw error;
    }
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
): Promise<TelegramSendResult> {
  return withAuthorizedUserClient(tenantId, connectionId, async (client) => {
    try {
      const entity = await resolveSendEntity(client, {
        id: target.telegramGroupId ?? null,
        username: target.username ?? null,
        accessHash: target.accessHash ?? null,
        entityType: target.entityType ?? null,
      });
      if (entity instanceof Api.Channel && !channelWritable(entity)) {
        throw new Error("CHAT_WRITE_FORBIDDEN: selected Telegram session cannot post to this group/channel.");
      }
      await validateCustomEmojiEntities(client, message);
      const text = sendText(message);
      logOutgoingEntities("group", tenantId, connectionId, message);
      const sent = await client.sendMessage(entity, {
        ...(text ? { message: text } : {}),
        ...(message.media_url ? { file: message.media_url } : {}),
        ...(message.entities?.length ? { formattingEntities: buildFormattingEntities(message) } : {}),
        linkPreview: true,
      });
      await recordSessionHealthEvidence({ tenantId, connectionId, evidence: "SEND_OK", reason: "Group message sent successfully" });
      await db()
        .from("telegram_connections")
        .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", connectionId)
        .eq("tenant_id", tenantId);
      const result = summarizeSentMessage(sent);
      logReturnedEntities("group", tenantId, connectionId, result);
      return result;
    } catch (error) {
      const classified = classifyTelegramError(error);
      await recordSessionHealthEvidence({
        tenantId,
        connectionId,
        evidence:
          classified.scope === "AUTH"
            ? "AUTH_FAILURE"
            : classified.scope === "RATE_LIMIT"
              ? "RATE_LIMIT"
              : classified.sessionLevel
                ? "SESSION_FAILURE"
                : classified.groupLevel
                  ? "GROUP_FAILURE"
                  : "TRANSIENT",
        reason: classified.human,
        details: { raw: classified.raw, code: classified.code, scope: classified.scope },
      });
      throw error;
    }
  });
}

export async function sendDirectViaUserSession(
  tenantId: string,
  connectionId: string,
  target: { telegramUserId?: number | null; username?: string | null; accessHash?: string | null },
  message: MessagePayload,
): Promise<TelegramSendResult> {
  return withAuthorizedUserClient(tenantId, connectionId, async (client) => {
    try {
      const entity = await resolveSendEntity(client, {
        id: target.telegramUserId ?? null,
        username: target.username ?? null,
        accessHash: target.accessHash ?? null,
        entityType: "USER",
      });
      await validateCustomEmojiEntities(client, message);
      const text = sendText(message);
      logOutgoingEntities("dm", tenantId, connectionId, message);
      const sent = await client.sendMessage(entity, {
        ...(text ? { message: text } : {}),
        ...(message.media_url ? { file: message.media_url } : {}),
        ...(message.entities?.length ? { formattingEntities: buildFormattingEntities(message) } : {}),
        linkPreview: true,
      });
      await recordSessionHealthEvidence({ tenantId, connectionId, evidence: "SEND_OK", reason: "Direct message sent successfully" });
      await db()
        .from("telegram_connections")
        .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", connectionId)
        .eq("tenant_id", tenantId);
      const result = summarizeSentMessage(sent);
      logReturnedEntities("dm", tenantId, connectionId, result);
      return result;
    } catch (error) {
      const classified = classifyTelegramError(error);
      await recordSessionHealthEvidence({
        tenantId,
        connectionId,
        evidence:
          classified.scope === "AUTH"
            ? "AUTH_FAILURE"
            : classified.scope === "RATE_LIMIT"
              ? "RATE_LIMIT"
              : classified.sessionLevel
                ? "SESSION_FAILURE"
                : classified.groupLevel
                  ? "GROUP_FAILURE"
                  : "TRANSIENT",
        reason: classified.human,
        details: { raw: classified.raw, code: classified.code, scope: classified.scope },
      });
      throw error;
    }
  });
}

export async function sendAndRefetchViaUserSession(
  tenantId: string,
  connectionId: string,
  target: string | number,
  message: MessagePayload,
): Promise<TelegramVerifiedSendResult> {
  return withAuthorizedUserClient(tenantId, connectionId, async (client) => {
    await validateCustomEmojiEntities(client, message);
    const text = sendText(message);
    logOutgoingEntities("verified_direct_target", tenantId, connectionId, message);
    const sentMessage = await client.sendMessage(target, {
      ...(text ? { message: text } : {}),
      ...(message.media_url ? { file: message.media_url } : {}),
      ...(message.entities?.length ? { formattingEntities: buildFormattingEntities(message) } : {}),
      linkPreview: true,
    });
    const sent = summarizeSentMessage(sentMessage);
    logReturnedEntities("verified_direct_target", tenantId, connectionId, sent);
    const refetched = await refetchSentMessage(client, target, sent);
    if (refetched) logReturnedEntities("verified_refetch", tenantId, connectionId, refetched);
    await recordSessionHealthEvidence({ tenantId, connectionId, evidence: "SEND_OK", reason: "Verified message sent successfully" });
    await db()
      .from("telegram_connections")
      .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", connectionId)
      .eq("tenant_id", tenantId);
    return { sent, refetched };
  });
}
