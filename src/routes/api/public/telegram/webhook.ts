import { createFileRoute } from "@tanstack/react-router";
import { db, getSetting, logSystem } from "@/lib/db.server";
import { deriveWebhookSecret, hashPassword, safeEqual, verifyPassword } from "@/lib/security.server";
import { botToken, callBot } from "@/lib/telegram.server";
import {
  clearTelegramFlow,
  createCustomerSessionForCustomer,
  loginCustomer,
  normalizeEmail,
  registerCustomerWithPasswordHash,
  validEmail,
} from "@/lib/customer-auth.server";
import { normalizeLanguage, t } from "@/lib/i18n";
import { saveCustomerPreferences } from "@/lib/preferences.server";
import type { LanguageCode } from "@/lib/i18n";

type TgUser = { id: number; username?: string; first_name?: string; language_code?: string };
type TgChat = { id: number; type: string; title?: string; username?: string };
type TgMessage = { message_id: number; from?: TgUser; chat: TgChat; text?: string };
type Update = {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  callback_query?: { id: string; from: TgUser; data?: string; message?: TgMessage };
};

const botMessages: Record<LanguageCode, Record<string, string>> = {
  en: {
    miniAppMissing: "The Mini App URL has not been configured by the platform admin yet.",
    helpText: "Register or log in here, then open the Mini App. It is your full dashboard.",
    cancelDone: "Cancelled.",
    validEmailPrompt: "Send a valid email address, or /cancel to stop.",
    registrationPasswordPrompt: "Send a password with at least 8 characters.",
    confirmPasswordPrompt: "Confirm your password.",
    passwordTooShort: "Password must be at least 8 characters. Send a new password, or /cancel.",
    passwordsMismatch: "Passwords did not match. Send /register to start again.",
    pendingApproval: "Account created and pending admin approval.",
    loginOpenMiniApp: "Login successful. Open the Mini App to continue.",
    registrationOpenMiniApp: "Account created. Open the Mini App to continue.",
  },
  "zh-CN": {
    miniAppMissing: "Mini App URL has not been configured.",
    helpText: "Register or log in here, then open the Mini App.",
    cancelDone: "Cancelled.",
    validEmailPrompt: "Send a valid email address, or /cancel to stop.",
    registrationPasswordPrompt: "Send a password with at least 8 characters.",
    confirmPasswordPrompt: "Confirm your password.",
    passwordTooShort: "Password must be at least 8 characters. Send a new password, or /cancel.",
    passwordsMismatch: "Passwords did not match. Send /register to start again.",
    pendingApproval: "Account created and pending admin approval.",
    loginOpenMiniApp: "Login successful. Open the Mini App to continue.",
    registrationOpenMiniApp: "Account created. Open the Mini App to continue.",
  },
  ru: {
    miniAppMissing: "Mini App URL has not been configured.",
    helpText: "Register or log in here, then open the Mini App.",
    cancelDone: "Cancelled.",
    validEmailPrompt: "Send a valid email address, or /cancel to stop.",
    registrationPasswordPrompt: "Send a password with at least 8 characters.",
    confirmPasswordPrompt: "Confirm your password.",
    passwordTooShort: "Password must be at least 8 characters. Send a new password, or /cancel.",
    passwordsMismatch: "Passwords did not match. Send /register to start again.",
    pendingApproval: "Account created and pending admin approval.",
    loginOpenMiniApp: "Login successful. Open the Mini App to continue.",
    registrationOpenMiniApp: "Account created. Open the Mini App to continue.",
  },
  fa: {
    miniAppMissing: "Mini App URL has not been configured.",
    helpText: "Register or log in here, then open the Mini App.",
    cancelDone: "Cancelled.",
    validEmailPrompt: "Send a valid email address, or /cancel to stop.",
    registrationPasswordPrompt: "Send a password with at least 8 characters.",
    confirmPasswordPrompt: "Confirm your password.",
    passwordTooShort: "Password must be at least 8 characters. Send a new password, or /cancel.",
    passwordsMismatch: "Passwords did not match. Send /register to start again.",
    pendingApproval: "Account created and pending admin approval.",
    loginOpenMiniApp: "Login successful. Open the Mini App to continue.",
    registrationOpenMiniApp: "Account created. Open the Mini App to continue.",
  },
};

function bt(language: string | null | undefined, key: string) {
  const lang = normalizeLanguage(language);
  return botMessages[lang][key] ?? botMessages.en[key] ?? key;
}

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

async function deleteMessage(chatId: number, messageId: number) {
  const result = await callBot("deleteMessage", {
    chat_id: chatId,
    message_id: messageId,
  });
  diagnostic("telegram_api", {
    method: "deleteMessage",
    chat_id: chatId,
    ok: result.ok,
    error: result.ok ? null : result.error,
  });
}

function miniAppUrlWithSession(url: string, sessionToken?: string) {
  if (!sessionToken) return url;
  return `${url}#sess=${encodeURIComponent(sessionToken)}`;
}

async function openMiniAppKeyboard(sessionToken?: string) {
  const url = await miniAppUrl();
  if (!url) return null;
  return {
    inline_keyboard: [[{ text: "OPEN MINI APP", web_app: { url: miniAppUrlWithSession(url, sessionToken) } }]],
  };
}

async function sendOpenMiniApp(chatId: number, text: string, sessionToken?: string) {
  const keyboard = await openMiniAppKeyboard(sessionToken);
  await send(
    chatId,
    keyboard
      ? text
      : `${text}\n\n${bt("en", "miniAppMissing")}`,
    keyboard ?? undefined,
  );
}

async function botLanguage(user: TgUser) {
  const { data: customer } = await db()
    .from("customers")
    .select("id, tenant_id, customer_preferences(language)")
    .eq("telegram_user_id", user.id)
    .maybeSingle();
  const pref = Array.isArray(customer?.customer_preferences) ? customer?.customer_preferences[0] : customer?.customer_preferences;
  if (pref?.language) return normalizeLanguage(pref.language);
  const { data: pending } = await db()
    .from("bot_language_preferences")
    .select("language")
    .eq("telegram_user_id", user.id)
    .maybeSingle();
  return normalizeLanguage(pending?.language ?? user.language_code);
}

async function persistBotLanguage(userId: number, language: string) {
  const normalized = normalizeLanguage(language);
  await db().from("bot_language_preferences").upsert(
    { telegram_user_id: userId, language: normalized, updated_at: new Date().toISOString() },
    { onConflict: "telegram_user_id" },
  );
  const { data: customer } = await db()
    .from("customers")
    .select("id, tenant_id, email, name, telegram_user_id")
    .eq("telegram_user_id", userId)
    .maybeSingle();
  if (!customer) return;
  await saveCustomerPreferences(
    {
      customerId: customer.id as string,
      tenantId: customer.tenant_id as string,
      email: customer.email as string,
      name: (customer.name as string | null) ?? null,
      telegramUserId: (customer.telegram_user_id as number | null) ?? null,
    },
    { language: normalized },
  );
}

async function mainMenu(chatId: number, user: TgUser) {
  const language = await botLanguage(user);
  const url = await miniAppUrl();
  const { data: customer } = await db()
    .from("customers")
    .select("id")
    .eq("telegram_user_id", user.id)
    .eq("status", "ACTIVE")
    .maybeSingle();
  const rows: Record<string, unknown>[][] = [
    [
      { text: t(language, "register").toUpperCase(), callback_data: "register" },
      { text: t(language, "login").toUpperCase(), callback_data: "login" },
    ],
    [
      (url
        ? [{ text: t(language, "openMiniApp").toUpperCase(), web_app: { url } }][0]
        : { text: `${t(language, "openMiniApp").toUpperCase()} (NOT CONFIGURED)`, callback_data: "miniapp_missing" }) as Record<string, unknown>,
      { text: t(language, "help").toUpperCase(), callback_data: "help" },
    ],
    [
      { text: "English", callback_data: "lang:en" },
      { text: "中文", callback_data: "lang:zh-CN" },
      { text: "Русский", callback_data: "lang:ru" },
      { text: "فارسی", callback_data: "lang:fa" },
    ],
  ];
  await send(
    chatId,
    customer
      ? `<b>${t(language, "start")}</b>\n\n${t(language, "openMiniApp")} to manage your dashboard.`
      : `<b>${t(language, "start")}</b>\n\n${t(language, "register")} / ${t(language, "login")} -> ${t(language, "openMiniApp")}.`,
    { inline_keyboard: rows },
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
  const { flow, step, payload } = await getState(userId);
  const language = await botLanguage(msg.from!);

  if (text === "/start" || text === "/menu") {
    diagnostic("handler", { handler: "main_menu", chat_id: chatId });
    await clearTelegramFlow(userId);
    await mainMenu(chatId, msg.from!);
    return;
  }
  if (text === "/register") {
    diagnostic("handler", { handler: "registration_email", chat_id: chatId });
    await setState(userId, "REGISTRATION", "EMAIL");
    await send(chatId, t(language, "emailPrompt"));
    return;
  }
  if (text === "/login") {
    diagnostic("handler", { handler: "login_email", chat_id: chatId });
    await setState(userId, "LOGIN", "EMAIL", {
      telegram_username: msg.from?.username ?? null,
      first_name: msg.from?.first_name ?? null,
    });
    await send(chatId, t(language, "emailPrompt"));
    return;
  }
  if (text === "/help") {
    diagnostic("handler", { handler: "help", chat_id: chatId });
    await send(chatId, bt(language, "helpText"));
    return;
  }
  if (text === "/help_legacy_disabled") {
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
    await send(chatId, bt(language, "cancelDone"));
    return;
  }

  if (flow === "REGISTRATION" && step === "EMAIL") {
    diagnostic("handler", { handler: "registration_password", chat_id: chatId });
    const email = normalizeEmail(text);
    if (!validEmail(email)) {
      await send(chatId, bt(language, "validEmailPrompt"));
      return;
    }
    await setState(userId, "REGISTRATION", "PASSWORD", {
      email,
      telegram_username: msg.from?.username ?? null,
      first_name: msg.from?.first_name ?? null,
    });
    await send(chatId, bt(language, "registrationPasswordPrompt"));
    return;
  }

  if (flow === "REGISTRATION" && step === "PASSWORD") {
    diagnostic("handler", { handler: "registration_confirm_password", chat_id: chatId });
    await deleteMessage(chatId, msg.message_id);
    if (text.length < 8) {
      await send(chatId, bt(language, "passwordTooShort"));
      return;
    }
    await setState(userId, "REGISTRATION", "CONFIRM_PASSWORD", {
      ...payload,
      password_hash: await hashPassword(text),
    });
    await send(chatId, bt(language, "confirmPasswordPrompt"));
    return;
  }

  if (flow === "REGISTRATION" && step === "CONFIRM_PASSWORD") {
    diagnostic("handler", { handler: "registration_create_account", chat_id: chatId });
    await deleteMessage(chatId, msg.message_id);
    const email = normalizeEmail(String(payload.email ?? ""));
    const passwordHash = typeof payload.password_hash === "string" ? payload.password_hash : "";
    if (!email || !passwordHash || !(await verifyPassword(text, passwordHash))) {
      await clearTelegramFlow(userId);
      await send(chatId, bt(language, "passwordsMismatch"));
      return;
    }
    const result = await registerCustomerWithPasswordHash({
      email,
      passwordHash,
      telegramUserId: userId,
      telegramUsername: msg.from?.username ?? null,
      name: typeof payload.first_name === "string" ? payload.first_name : null,
    });
    await clearTelegramFlow(userId);
    if (!result.ok) {
      await send(chatId, result.error);
      return;
    }
    if (result.status !== "ACTIVE") {
      await send(chatId, bt(language, "pendingApproval"));
      return;
    }
    await saveCustomerPreferences(
      {
        customerId: result.customerId,
        tenantId: result.tenantId,
        email,
        name: typeof payload.first_name === "string" ? payload.first_name : null,
        telegramUserId: userId,
      },
      { language },
    );
    const sessionToken = await createCustomerSessionForCustomer({
      customerId: result.customerId,
      tenantId: result.tenantId,
    });
    await sendOpenMiniApp(chatId, bt(language, "registrationOpenMiniApp"), sessionToken);
    return;
  }

  if (flow === "LOGIN" && step === "EMAIL") {
    diagnostic("handler", { handler: "login_password", chat_id: chatId });
    const email = normalizeEmail(text);
    if (!validEmail(email)) {
      await send(chatId, bt(language, "validEmailPrompt"));
      return;
    }
    await setState(userId, "LOGIN", "PASSWORD", {
      email,
      telegram_username: msg.from?.username ?? null,
      first_name: msg.from?.first_name ?? null,
    });
    await send(chatId, t(language, "passwordPrompt"));
    return;
  }

  if (flow === "LOGIN" && step === "PASSWORD") {
    diagnostic("handler", { handler: "login_complete", chat_id: chatId });
    await deleteMessage(chatId, msg.message_id);
    const email = normalizeEmail(String(payload.email ?? ""));
    const result = await loginCustomer({
      email,
      password: text,
      telegramUserId: userId,
      telegramUsername: msg.from?.username ?? null,
    });
    await clearTelegramFlow(userId);
    if (!result.ok) {
      await send(chatId, result.error);
      return;
    }
    await saveCustomerPreferences(
      {
        customerId: result.customerId,
        tenantId: result.tenantId,
        email,
        name: null,
        telegramUserId: userId,
      },
      { language },
    );
    await sendOpenMiniApp(chatId, bt(language, "loginOpenMiniApp"), result.token);
    return;
  }

  diagnostic("handler", { handler: "fallback_menu", chat_id: chatId });
  await mainMenu(chatId, msg.from!);
}

async function processUpdate(update: Update) {
  try {
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat.id ?? cq.from.id;
      diagnostic("handler", { handler: `callback_${cq.data ?? "unknown"}`, chat_id: chatId });
      await callBot("answerCallbackQuery", { callback_query_id: cq.id });
      if (cq.data?.startsWith("lang:")) {
        const language = normalizeLanguage(cq.data.slice(5));
        await persistBotLanguage(cq.from.id, language);
        await send(chatId, t(language, "settingsSaved"));
        await mainMenu(chatId, { ...cq.from, language_code: language });
      } else if (cq.data === "register") {
        await setState(cq.from.id, "REGISTRATION", "EMAIL");
        await send(chatId, t(await botLanguage(cq.from), "emailPrompt"));
      } else if (cq.data === "login") {
        await setState(cq.from.id, "LOGIN", "EMAIL", {
          telegram_username: cq.from?.username ?? null,
          first_name: cq.from?.first_name ?? null,
        });
        await send(chatId, t(await botLanguage(cq.from), "emailPrompt"));
      } else if (cq.data === "help") {
        await send(chatId, `${t(await botLanguage(cq.from), "register")} / ${t(await botLanguage(cq.from), "login")} -> ${t(await botLanguage(cq.from), "openMiniApp")}.`);
      } else if (cq.data === "miniapp_missing") {
        await send(chatId, bt(await botLanguage(cq.from), "miniAppMissing"));
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
