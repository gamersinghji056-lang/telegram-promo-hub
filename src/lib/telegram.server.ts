import { db, getSetting } from "./db.server";

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
  media_type?: string | null;
  media_url?: string | null;
  buttons?: { text: string; url: string }[];
};

export function buildSendArgs(chatId: string | number, message: MessagePayload) {
  const buttons = (message.buttons ?? []).filter((b) => b.text && b.url);
  const reply_markup = buttons.length
    ? { inline_keyboard: buttons.map((b) => [{ text: b.text, url: b.url }]) }
    : undefined;

  if (message.media_url && message.media_type === "photo") {
    return {
      method: "sendPhoto",
      body: { chat_id: chatId, photo: message.media_url, caption: message.text ?? "", reply_markup },
    };
  }
  if (message.media_url && message.media_type === "video") {
    return {
      method: "sendVideo",
      body: { chat_id: chatId, video: message.media_url, caption: message.text ?? "", reply_markup },
    };
  }
  return {
    method: "sendMessage",
    body: { chat_id: chatId, text: message.text ?? "", disable_web_page_preview: false, reply_markup },
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
  const s = await getSetting<{ bot_username?: string; mini_app_url?: string }>("telegram");
  return {
    bot_username: s.bot_username ?? "",
    mini_app_url: s.mini_app_url ?? "",
    token_configured: !!botToken(),
  };
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
