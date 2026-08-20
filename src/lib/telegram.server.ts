import { db, getSetting } from "./db.server";
import { deriveWebhookSecret } from "./security.server";

export const TELEGRAM_API = "https://api.telegram.org";

export function botToken(): string | null {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  return token && token.length > 10 ? token : null;
}

export class NotConfiguredError extends Error {
  constructor(what: string) {
    super(`${what} is not configured`);
  }
}

export async function callBot<T = unknown>(
  method: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  const token = botToken();
  if (!token) return { ok: false, error: "Telegram bot token is not configured" };

  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let json: { ok?: boolean; result?: T; description?: string };
  try {
    json = JSON.parse(text) as typeof json;
  } catch {
    return { ok: false, error: `Telegram returned a non-JSON response [${res.status}]` };
  }
  if (!res.ok || !json.ok) {
    return { ok: false, error: json.description ?? `Telegram error [${res.status}]` };
  }
  return { ok: true, result: json.result as T };
}

export type MessagePayload = {
  text?: string;
  entities?: {
    type: "custom_emoji" | "bold" | "italic" | "underline" | "strikethrough" | "spoiler" | "text_link";
    offset: number;
    length: number;
    document_id?: string;
    fallback?: string;
    url?: string;
  }[];
  media_type?: string | null;
  media_url?: string | null;
  buttons?: { text: string; url: string }[];
};

export type TelegramWebhookInfo = {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronization_error_date?: number;
  max_connections?: number;
  allowed_updates?: string[];
};

export function buildSendArgs(chatId: string | number, message: MessagePayload) {
  const buttons = (message.buttons ?? []).filter((b) => b.text && b.url);
  const reply_markup = buttons.length
    ? { inline_keyboard: buttons.map((b) => [{ text: b.text, url: b.url }]) }
    : undefined;

  if (message.media_url && message.media_type === "photo") {
    return {
      method: "sendPhoto",
      body: {
        chat_id: chatId,
        photo: message.media_url,
        caption: message.text ?? "",
        reply_markup,
      },
    };
  }
  if (message.media_url && message.media_type === "video") {
    return {
      method: "sendVideo",
      body: {
        chat_id: chatId,
        video: message.media_url,
        caption: message.text ?? "",
        reply_markup,
      },
    };
  }
  return {
    method: "sendMessage",
    body: {
      chat_id: chatId,
      text: message.text ?? "",
      disable_web_page_preview: false,
      reply_markup,
    },
  };
}

export async function sendMessage(chatId: string | number, message: MessagePayload) {
  const { method, body } = buildSendArgs(chatId, message);
  return callBot(method, body);
}

export async function botNotify(telegramUserId: number | null | undefined, text: string) {
  if (!telegramUserId) return;
  await callBot("sendMessage", { chat_id: telegramUserId, text });
}

export async function telegramSettings() {
  const s = await getSetting<{
    bot_username?: string;
    mini_app_url?: string;
    webhook_url?: string;
    webhook_status?: string;
    webhook_last_checked_at?: string;
    webhook_last_error?: string | null;
    webhook_last_error_at?: string | null;
    webhook_pending_updates?: number;
    last_successful_update_at?: string | null;
  }>("telegram");
  return {
    bot_username: s.bot_username ?? "",
    mini_app_url: s.mini_app_url ?? "",
    token_configured: !!botToken(),
    webhook_url: s.webhook_url ?? "",
    webhook_status: s.webhook_status ?? "NOT_CHECKED",
    webhook_last_checked_at: s.webhook_last_checked_at ?? null,
    webhook_last_error: s.webhook_last_error ?? null,
    webhook_last_error_at: s.webhook_last_error_at ?? null,
    webhook_pending_updates: s.webhook_pending_updates ?? 0,
    last_successful_update_at: s.last_successful_update_at ?? null,
  };
}

function configuredWebhookUrl(): string | null {
  const base = process.env["PUBLIC_APP_URL"];
  if (!base) return null;
  try {
    const url = new URL(base);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    const webhook = new URL("/api/public/telegram/webhook", url.origin);
    return webhook.toString();
  } catch {
    return null;
  }
}

async function saveWebhookHealth(info: TelegramWebhookInfo, status: string) {
  const current = await getSetting<Record<string, unknown>>("telegram");
  await db()
    .from("system_settings")
    .upsert(
      {
        key: "telegram",
        value: {
          ...current,
          webhook_url: info.url,
          webhook_status: status,
          webhook_pending_updates: info.pending_update_count,
          webhook_last_error: info.last_error_message ?? null,
          webhook_last_error_at: info.last_error_date
            ? new Date(info.last_error_date * 1000).toISOString()
            : null,
          webhook_last_checked_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
}

export async function checkWebhook() {
  const expectedUrl = configuredWebhookUrl();
  if (!expectedUrl) return { ok: false as const, error: "PUBLIC_APP_URL is not configured" };
  const result = await callBot<TelegramWebhookInfo>("getWebhookInfo", {});
  if (!result.ok) return result;
  const status =
    result.result.url === expectedUrl
      ? "HEALTHY"
      : result.result.url
        ? "WRONG_URL"
        : "NOT_REGISTERED";
  await saveWebhookHealth(result.result, status);
  return { ok: true as const, result: { ...result.result, expected_url: expectedUrl, status } };
}

export async function registerWebhook() {
  const token = botToken();
  if (!token) return { ok: false as const, error: "Telegram bot token is not configured" };
  const url = configuredWebhookUrl();
  if (!url) return { ok: false as const, error: "PUBLIC_APP_URL is not configured" };
  const registration = await callBot<boolean>("setWebhook", {
    url,
    secret_token: deriveWebhookSecret(token),
    allowed_updates: ["message", "edited_message", "callback_query"],
  });
  if (!registration.ok) return registration;
  const verification = await checkWebhook();
  if (!verification.ok) return verification;
  if (verification.result.url !== url) {
    return {
      ok: false as const,
      error: `Telegram confirmed a different webhook URL: ${verification.result.url || "none"}`,
    };
  }
  return verification;
}

/** Refresh bot identity into the telegram settings row; used by admin "Check status". */
export async function syncBotIdentity() {
  const res = await callBot<{ username: string; first_name: string; id: number }>("getMe", {});
  if (!res.ok) return res;
  const current = await getSetting<Record<string, unknown>>("telegram");
  await db()
    .from("system_settings")
    .upsert(
      {
        key: "telegram",
        value: { ...current, bot_username: res.result.username, bot_token_configured: true },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
  return res;
}
