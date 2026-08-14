import { createFileRoute } from "@tanstack/react-router";
import { db, getSetting, logSystem } from "@/lib/db.server";
import { deriveWebhookSecret, safeEqual } from "@/lib/security.server";
import { botToken, callBot } from "@/lib/telegram.server";
import {
  clearTelegramFlow,
  createTelegramFlow,
  normalizeEmail,
  validEmail,
} from "@/lib/customer-auth.server";

type TgUser = { id: number; username?: string; first_name?: string };
type TgChat = { id: number; type: string; title?: string; username?: string };
type TgMessage = { message_id: number; from?: TgUser; chat: TgChat; text?: string };
type Update = {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  callback_query?: { id: string; from: TgUser; data?: string; message?: TgMessage };
};

function diagnostic(event: string, details: Record<string, unknown>) {
  console.info(JSON.stringify({ event: `telegram_webhook_${event}`, ...details }));
}

function updateType(update: Update) {
  if (update.callback_query) return "callback_query";
  if (update.message) return "message";
  if (update.edited_message) return "edited_message";
  return "unknown";
}

function updateChatId(update: Update) {
  return (
    update.callback_query?.message?.chat.id ??
    update.callback_query?.from.id ??
    update.message?.chat.id ??
    update.edited_message?.chat.id ??
    null
  );
}

async function miniAppUrl() {
  const s = await getSetting<{ mini_app_url?: string }>("telegram");
  return validMiniAppUrl(s.mini_app_url ?? "");
}

function validMiniAppUrl(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    const isLocal = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) return "";
    if (url.username || url.password) return "";
    if (!["/mini-app", "/mini-app/"].includes(url.pathname)) return "";
    url.pathname = "/mini-app";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function appendMiniAppPath(
  base: string,
  path: "register" | "login",
  params: Record<string, string>,
) {
  const root = base.replace(/\/$/, "");
  const search = new URLSearchParams(params);
  return `${root}/${path}?${search.toString()}`;
}

async function setState(
  userId: number,
  flow: "REGISTRATION" | "LOGIN",
  step: string,
  payload: Record<string, unknown> = {},
) {
  await db()
    .from("bot_states")
    .upsert(
      {
        telegram_user_id: userId,
        flow,
        step,
        state: `${flow}:${step}`,
        payload,
        flow_token_hash: null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 20 * 60_000).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "telegram_user_id" },
    );
}

async function getState(userId: number) {
  const { data } = await db()
    .from("bot_states")
    .select("*")
    .eq("telegram_user_id", userId)
    .maybeSingle();
  if (!data) return { flow: "IDLE", step: "IDLE", payload: {} as Record<string, unknown> };
  if (data.expires_at && new Date(data.expires_at as string) < new Date()) {
    await clearTelegramFlow(userId);
    return { flow: "IDLE", step: "IDLE", payload: {} as Record<string, unknown> };
  }
  return {
    flow: (data.flow as string) ?? "IDLE",
    step: (data.step as string) ?? "IDLE",
    payload: (data.payload as Record<string, unknown>) ?? {},
  };
}

async function send(chatId: number, text: string, keyboard?: Record<string, unknown>) {
  const result = await callBot("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup: keyboard,
  });
  diagnostic("telegram_api", {
    method: "sendMessage",
    chat_id: chatId,
    ok: result.ok,
    error: result.ok ? null : result.error,
  });
  if (!result.ok) throw new Error(`Telegram sendMessage failed: ${result.error}`);
}

async function mainMenu(chatId: number, userId: number) {
  const url = await miniAppUrl();
  const { data: customer } = await db()
    .from("customers")
    .select("id")
    .eq("telegram_user_id", userId)
    .eq("status", "ACTIVE")
    .maybeSingle();
  const rows: Record<string, unknown>[][] = [
    [
      { text: "REGISTER", callback_data: "register" },
      { text: "LOGIN", callback_data: "login" },
    ],
    [
      url
        ? [{ text: "OPEN MINI APP", web_app: { url } }][0]
        : { text: "OPEN MINI APP (NOT CONFIGURED)", callback_data: "miniapp_missing" },
      { text: "HELP", callback_data: "help" },
    ],
  ];
  await send(
    chatId,
    customer
      ? "<b>Welcome back to the Telegram Promotion Platform.</b>\n\nOpen the Mini App to manage your dashboard."
      : "<b>Welcome to the Telegram Promotion Platform.</b>\n\nRegister or log in, then use the Mini App to manage your dashboard.",
    { inline_keyboard: rows },
  );
}

async function sendRegistrationButton(msg: TgMessage, email: string) {
  const url = await miniAppUrl();
  if (!url) {
    await send(
      msg.chat.id,
      "Registration can continue after the platform admin configures the Mini App URL.",
    );
    return;
  }
  const flowToken = await createTelegramFlow({
    telegramUserId: msg.from!.id,
    flow: "REGISTRATION",
    step: "MINI_APP",
    payload: {
      email,
      telegram_username: msg.from?.username ?? null,
      first_name: msg.from?.first_name ?? null,
    },
  });
  await send(
    msg.chat.id,
    "Continue registration in the secure Mini App. Do not send your password in Telegram.",
    {
      inline_keyboard: [
        [
          {
            text: "CONTINUE REGISTRATION",
            web_app: { url: appendMiniAppPath(url, "register", { flow: flowToken, email }) },
          },
        ],
      ],
    },
  );
}

async function sendLoginButton(msg: TgMessage) {
  const url = await miniAppUrl();
  if (!url) {
    await send(
      msg.chat.id,
      "Login can continue after the platform admin configures the Mini App URL.",
    );
    return;
  }
  const flowToken = await createTelegramFlow({
    telegramUserId: msg.from!.id,
    flow: "LOGIN",
    step: "MINI_APP",
    payload: {
      telegram_username: msg.from?.username ?? null,
      first_name: msg.from?.first_name ?? null,
    },
  });
  await send(
    msg.chat.id,
    "Open the secure Mini App login. Do not send your password in Telegram.",
    {
      inline_keyboard: [
        [
          {
            text: "CONTINUE LOGIN",
            web_app: { url: appendMiniAppPath(url, "login", { flow: flowToken }) },
          },
        ],
      ],
    },
  );
}

/** Records people who message the bot: these are the only legitimately contactable users. */
async function captureOptIn(msg: TgMessage) {
  if (!msg.from || msg.chat.type === "private") return;
  const client = db();
  const { data: group } = await client
    .from("discovered_groups")
    .select("id, tenant_id")
    .eq("telegram_group_id", msg.chat.id)
    .maybeSingle();
  if (!group) return;
  await client.from("audience_contacts").upsert(
    {
      tenant_id: group.tenant_id,
      telegram_user_id: msg.from.id,
      display_name: msg.from.first_name ?? null,
      username: msg.from.username ?? null,
      source_group_id: group.id,
      eligibility: "OPTED_IN",
    },
    { onConflict: "tenant_id,telegram_user_id", ignoreDuplicates: true },
  );
}

async function handlePrivateText(msg: TgMessage) {
  const chatId = msg.chat.id;
  const userId = msg.from!.id;
  const text = (msg.text ?? "").trim();
  const { flow, step } = await getState(userId);

  if (text === "/start" || text === "/menu") {
    diagnostic("handler", { handler: "main_menu", chat_id: chatId });
    await clearTelegramFlow(userId);
    await mainMenu(chatId, userId);
    return;
  }
  if (text === "/register") {
    diagnostic("handler", { handler: "registration_email", chat_id: chatId });
    await setState(userId, "REGISTRATION", "EMAIL");
    await send(chatId, "Send the email address you want to register with.");
    return;
  }
  if (text === "/login") {
    diagnostic("handler", { handler: "login_button", chat_id: chatId });
    await sendLoginButton(msg);
    return;
  }
  if (text === "/help") {
    diagnostic("handler", { handler: "help", chat_id: chatId });
    await send(
      chatId,
      "Register or log in here, then open the Mini App — it is your full dashboard: connections, group discovery, audience, campaigns, analytics and billing.",
    );
    return;
  }
  if (text === "/cancel") {
    diagnostic("handler", { handler: "cancel", chat_id: chatId });
    await clearTelegramFlow(userId);
    await send(chatId, "Cancelled.");
    return;
  }

  if (flow === "REGISTRATION" && step === "EMAIL") {
    diagnostic("handler", { handler: "registration_continue", chat_id: chatId });
    const email = normalizeEmail(text);
    if (!validEmail(email)) {
      await send(chatId, "Send a valid email address, or /cancel to stop registration.");
      return;
    }
    await sendRegistrationButton(msg, email);
    return;
  }

  if ((flow === "REGISTRATION" || flow === "LOGIN") && step === "MINI_APP") {
    diagnostic("handler", { handler: "mini_app_wait", chat_id: chatId });
    await send(chatId, "Use the secure Mini App button to continue, or send /cancel to stop.");
    return;
  }

  diagnostic("handler", { handler: "fallback_menu", chat_id: chatId });
  await mainMenu(chatId, userId);
}

async function processUpdate(update: Update) {
  try {
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat.id ?? cq.from.id;
      diagnostic("handler", { handler: `callback_${cq.data ?? "unknown"}`, chat_id: chatId });
      await callBot("answerCallbackQuery", { callback_query_id: cq.id });
      if (cq.data === "register") {
        await setState(cq.from.id, "REGISTRATION", "EMAIL");
        await send(chatId, "Send the email address you want to register with.");
      } else if (cq.data === "login") {
        await sendLoginButton({
          chat: { id: chatId, type: "private" },
          from: cq.from,
          message_id: cq.message?.message_id ?? 0,
        });
      } else if (cq.data === "help") {
        await send(chatId, "Register, log in, then open the Mini App to manage everything.");
      } else if (cq.data === "miniapp_missing") {
        await send(
          chatId,
          "The Mini App URL has not been configured by the platform admin yet.",
        );
      }
      return;
    }

    const msg = update.message ?? update.edited_message;
    if (!msg?.from) return;

    if (msg.chat.type === "private") await handlePrivateText(msg);
    else {
      diagnostic("handler", { handler: "capture_opt_in", chat_id: msg.chat.id });
      await captureOptIn(msg);
    }
    const current = await getSetting<Record<string, unknown>>("telegram");
    await db()
      .from("system_settings")
      .upsert(
        {
          key: "telegram",
          value: { ...current, last_successful_update_at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Telegram webhook error";
    diagnostic("error", {
      update_id: update.update_id,
      chat_id: updateChatId(update),
      error: message,
    });
    await logSystem({
      action: "BOT_WEBHOOK_ERROR",
      status: "FAILED",
      details: { update_id: update.update_id, message },
    });
  }
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = botToken();
        if (!token) return new Response("Bot not configured", { status: 503 });

        const expected = deriveWebhookSecret(token);
        const provided = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!safeEqual(provided, expected)) return new Response("Unauthorized", { status: 401 });

        try {
          const update = (await request.json()) as Update;
          diagnostic("received", {
            update_id: update.update_id,
            message_type: updateType(update),
            chat_id: updateChatId(update),
          });
          void processUpdate(update);
        } catch (error) {
          diagnostic("parse_error", {
            error: error instanceof Error ? error.message : "Invalid update payload",
          });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
