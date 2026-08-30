import { createFileRoute } from "@tanstack/react-router";
import { db, getSetting, logSystem } from "@/lib/db.server";
import { deriveWebhookSecret, hashPassword, safeEqual, verifyPassword } from "@/lib/security.server";
import { botToken, callBot, canonicalMiniAppUrl, syncMiniAppMenuButton } from "@/lib/telegram.server";
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
import { parseReferralStart, recordReferralClick } from "@/lib/referrals.server";

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
    unknownCommand: "I did not recognize that command. Use the menu, /login, /register or /help.",
    menuLinked: "Open the Mini App to manage your dashboard.",
    menuGuest: "Register or log in, then open the Mini App.",
    openMiniAppButton: "Open Mini App",
  },
  "zh-CN": {
    miniAppMissing: "平台管理员尚未配置 Mini App URL。",
    helpText: "请在这里注册或登录，然后打开 Mini App。Mini App 是完整控制台。",
    cancelDone: "已取消。",
    validEmailPrompt: "请发送有效邮箱地址，或发送 /cancel 停止。",
    registrationPasswordPrompt: "请发送至少 8 个字符的密码。",
    confirmPasswordPrompt: "请确认您的密码。",
    passwordTooShort: "密码至少需要 8 个字符。请发送新密码，或发送 /cancel。",
    passwordsMismatch: "两次密码不一致。请发送 /register 重新开始。",
    pendingApproval: "账户已创建，正在等待管理员批准。",
    loginOpenMiniApp: "登录成功。请打开 Mini App 继续。",
    registrationOpenMiniApp: "账户已创建。请打开 Mini App 继续。",
    unknownCommand: "我没有识别此命令。请使用菜单、/login、/register 或 /help。",
    menuLinked: "打开 Mini App 管理您的控制台。",
    menuGuest: "注册或登录，然后打开 Mini App。",
    openMiniAppButton: "打开 Mini App",
  },
  ru: {
    miniAppMissing: "Администратор платформы еще не настроил URL Mini App.",
    helpText: "Зарегистрируйтесь или войдите здесь, затем откройте Mini App. Это ваша полная панель управления.",
    cancelDone: "Отменено.",
    validEmailPrompt: "Отправьте корректный email или /cancel для отмены.",
    registrationPasswordPrompt: "Отправьте пароль минимум из 8 символов.",
    confirmPasswordPrompt: "Подтвердите пароль.",
    passwordTooShort: "Пароль должен быть минимум 8 символов. Отправьте новый пароль или /cancel.",
    passwordsMismatch: "Пароли не совпали. Отправьте /register, чтобы начать заново.",
    pendingApproval: "Аккаунт создан и ожидает одобрения администратора.",
    loginOpenMiniApp: "Вход выполнен. Откройте Mini App, чтобы продолжить.",
    registrationOpenMiniApp: "Аккаунт создан. Откройте Mini App, чтобы продолжить.",
    unknownCommand: "Команда не распознана. Используйте меню, /login, /register или /help.",
    menuLinked: "Откройте Mini App для управления панелью.",
    menuGuest: "Зарегистрируйтесь или войдите, затем откройте Mini App.",
    openMiniAppButton: "Открыть Mini App",
  },
  fa: {
    miniAppMissing: "آدرس Mini App هنوز توسط مدیر پلتفرم تنظیم نشده است.",
    helpText: "اینجا ثبت‌نام یا ورود کنید، سپس Mini App را باز کنید. Mini App داشبورد کامل شماست.",
    cancelDone: "لغو شد.",
    validEmailPrompt: "یک ایمیل معتبر ارسال کنید، یا برای توقف /cancel را بفرستید.",
    registrationPasswordPrompt: "رمزی با حداقل ۸ کاراکتر ارسال کنید.",
    confirmPasswordPrompt: "رمز عبور خود را تایید کنید.",
    passwordTooShort: "رمز عبور باید حداقل ۸ کاراکتر باشد. رمز جدید بفرستید یا /cancel را ارسال کنید.",
    passwordsMismatch: "رمزها یکسان نبودند. برای شروع دوباره /register را ارسال کنید.",
    pendingApproval: "حساب ساخته شد و در انتظار تایید مدیر است.",
    loginOpenMiniApp: "ورود موفق بود. برای ادامه Mini App را باز کنید.",
    registrationOpenMiniApp: "حساب ساخته شد. برای ادامه Mini App را باز کنید.",
    unknownCommand: "این دستور شناخته نشد. از منو، /login، /register یا /help استفاده کنید.",
    menuLinked: "برای مدیریت داشبورد، Mini App را باز کنید.",
    menuGuest: "ثبت‌نام یا ورود کنید، سپس Mini App را باز کنید.",
    openMiniAppButton: "باز کردن Mini App",
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

async function miniAppUrl(source: string) {
  const value = canonicalMiniAppUrl();
  const url = new URL(value);
  diagnostic("mini_app_url", { source, origin: url.origin, path: url.pathname });
  return value;
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
  const target = new URL(url);
  target.hash = `sess=${encodeURIComponent(sessionToken)}`;
  return target.toString();
}

async function openMiniAppKeyboard(language?: string | null, sessionToken?: string, source = "open") {
  const url = await miniAppUrl(source);
  if (!url) return null;
  return {
    inline_keyboard: [[{ text: bt(language, "openMiniAppButton").toUpperCase(), web_app: { url: miniAppUrlWithSession(url, sessionToken) } }]],
  };
}

async function sendOpenMiniApp(chatId: number, language: string | null | undefined, text: string, sessionToken?: string, source = "open") {
  const keyboard = await openMiniAppKeyboard(language, sessionToken, source);
  await send(
    chatId,
    keyboard
      ? text
      : `${text}\n\n${bt(language, "miniAppMissing")}`,
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
  const url = await miniAppUrl("start_menu");
  const menuSync = await syncMiniAppMenuButton();
  if (!menuSync.ok) diagnostic("mini_app_menu_sync_failed", { error: menuSync.error });
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
      ? `<b>${t(language, "start")}</b>\n\n${bt(language, "menuLinked")}`
      : `<b>${t(language, "start")}</b>\n\n${bt(language, "menuGuest")}`,
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

  const referralCode = parseReferralStart(text);
  if (referralCode) {
    diagnostic("handler", { handler: "referral_start", chat_id: chatId });
    await recordReferralClick(referralCode, userId, msg.from?.username ?? null);
    await clearTelegramFlow(userId);
    await mainMenu(chatId, msg.from!);
    return;
  }

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
    await send(chatId, bt(language, "helpText"));
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
    await sendOpenMiniApp(chatId, language, bt(language, "registrationOpenMiniApp"), sessionToken, "registration_success");
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
    await sendOpenMiniApp(chatId, language, bt(language, "loginOpenMiniApp"), result.token, "login_success");
    return;
  }

  diagnostic("handler", { handler: "fallback_menu", chat_id: chatId });
  await send(chatId, bt(language, "unknownCommand"));
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
      POST: async ({ request }: { request: Request }) => {
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
