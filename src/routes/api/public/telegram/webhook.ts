import { createFileRoute } from "@tanstack/react-router";
import { db, getSetting, logSystem } from "@/lib/db.server";
import { deriveWebhookSecret, safeEqual } from "@/lib/security.server";
import { botToken, callBot } from "@/lib/telegram.server";
import { loginCustomer, registerCustomer } from "@/lib/customer-auth.server";

type TgUser = { id: number; username?: string; first_name?: string };
type TgChat = { id: number; type: string; title?: string; username?: string };
type TgMessage = { message_id: number; from?: TgUser; chat: TgChat; text?: string };
type Update = { update_id: number; message?: TgMessage; edited_message?: TgMessage; callback_query?: { id: string; from: TgUser; data?: string; message?: TgMessage } };

async function miniAppUrl() {
  const s = await getSetting<{ mini_app_url?: string }>("telegram");
  return s.mini_app_url ?? "";
}

async function setState(userId: number, state: string, payload: Record<string, unknown> = {}) {
  await db()
    .from("bot_states")
    .upsert({ telegram_user_id: userId, state, payload, updated_at: new Date().toISOString() }, { onConflict: "telegram_user_id" });
}

async function getState(userId: number) {
  const { data } = await db().from("bot_states").select("*").eq("telegram_user_id", userId).maybeSingle();
  return { state: (data?.state as string) ?? "IDLE", payload: (data?.payload as Record<string, unknown>) ?? {} };
}

async function send(chatId: number, text: string, keyboard?: Record<string, unknown>) {
  const result = await callBot("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", reply_markup: keyboard });
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
  const rows: Record<string, unknown>[][] = customer
    ? [url ? [{ text: "OPEN MINI APP", web_app: { url } }] : [{ text: "OPEN MINI APP (NOT CONFIGURED)", callback_data: "miniapp_missing" }]]
    : [[{ text: "REGISTER", callback_data: "register" }, { text: "LOGIN", callback_data: "login" }]];
  rows.push([{ text: "Help", callback_data: "help" }]);
  await send(
    chatId,
    "<b>Welcome to the Telegram Promotion Platform.</b>\n\nManage discovery, groups, audience and campaigns entirely from the Mini App.",
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
  const { state, payload } = await getState(userId);

  if (text === "/start" || text === "/menu") {
    await setState(userId, "IDLE");
    await mainMenu(chatId, userId);
    return;
  }
  if (text === "/register") {
    await setState(userId, "REG_EMAIL");
    await send(chatId, "Send the email address you want to register with.");
    return;
  }
  if (text === "/login") {
    await setState(userId, "LOGIN_EMAIL");
    await send(chatId, "Send your registered email address.");
    return;
  }
  if (text === "/help") {
    await send(
      chatId,
      "Register or log in here, then open the Mini App — it is your full dashboard: connections, group discovery, audience, campaigns, analytics and billing.",
    );
    return;
  }
  if (text === "/cancel") {
    await setState(userId, "IDLE");
    await send(chatId, "Cancelled.");
    return;
  }

  switch (state) {
    case "REG_EMAIL":
      await setState(userId, "REG_PASSWORD", { email: text });
      await send(chatId, "Now send a password (minimum 8 characters).");
      return;
    case "REG_PASSWORD":
      await setState(userId, "REG_CONFIRM", { ...payload, password: text });
      await send(chatId, "Confirm the password by sending it again.");
      return;
    case "REG_CONFIRM": {
      if (text !== payload["password"]) {
        await setState(userId, "REG_PASSWORD", { email: payload["email"] });
        await send(chatId, "Passwords did not match. Send the password again.");
        return;
      }
      const res = await registerCustomer({
        email: String(payload["email"] ?? ""),
        password: text,
        name: msg.from?.first_name ?? null,
        telegramUserId: userId,
        telegramUsername: msg.from?.username ?? null,
      });
      await setState(userId, "IDLE");
      if (!res.ok) {
        await send(chatId, `Registration failed: ${res.error}`);
        return;
      }
      await send(chatId, "Account created. You can log in now.");
       await mainMenu(chatId, userId);
      return;
    }
    case "LOGIN_EMAIL":
      await setState(userId, "LOGIN_PASSWORD", { email: text });
      await send(chatId, "Send your password.");
      return;
    case "LOGIN_PASSWORD": {
      const res = await loginCustomer({
        email: String(payload["email"] ?? ""),
        password: text,
        telegramUserId: userId,
        telegramUsername: msg.from?.username ?? null,
      });
      await setState(userId, "IDLE");
      if (!res.ok) {
        await send(chatId, `Login failed: ${res.error}`);
        return;
      }
      const url = await miniAppUrl();
      if (!url) {
        await send(chatId, "Login successful, but the Mini App URL is not configured yet. Ask the platform admin to set it.");
        return;
      }
      await send(chatId, "<b>Login successful.</b>", {
        inline_keyboard: [[{ text: "OPEN MINI APP", web_app: { url: `${url}#sess=${res.token}` } }]],
      });
      return;
    }
    default:
       await mainMenu(chatId, userId);
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

        const update = (await request.json()) as Update;

        try {
          if (update.callback_query) {
            const cq = update.callback_query;
            const chatId = cq.message?.chat.id ?? cq.from.id;
            await callBot("answerCallbackQuery", { callback_query_id: cq.id });
            if (cq.data === "register") {
              await setState(cq.from.id, "REG_EMAIL");
              await send(chatId, "Send the email address you want to register with.");
            } else if (cq.data === "login") {
              await setState(cq.from.id, "LOGIN_EMAIL");
              await send(chatId, "Send your registered email address.");
            } else if (cq.data === "help") {
              await send(chatId, "Register, log in, then open the Mini App to manage everything.");
            } else if (cq.data === "miniapp_missing") {
              await send(chatId, "The Mini App URL has not been configured by the platform admin yet.");
            }
            return Response.json({ ok: true });
          }

          const msg = update.message ?? update.edited_message;
          if (!msg?.from) return Response.json({ ok: true });

          if (msg.chat.type === "private") await handlePrivateText(msg);
          else await captureOptIn(msg);
          const current = await getSetting<Record<string, unknown>>("telegram");
          await db().from("system_settings").upsert(
            {
              key: "telegram",
              value: { ...current, last_successful_update_at: new Date().toISOString() },
              updated_at: new Date().toISOString(),
            },
            { onConflict: "key" },
          );
        } catch (error) {
          await logSystem({
            action: "BOT_WEBHOOK_ERROR",
            status: "FAILED",
            details: { message: (error as Error).message },
          });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
