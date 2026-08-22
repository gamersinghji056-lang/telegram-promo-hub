import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("TRON monitor uses overlap scan and does not advance cursor to wall clock on empty scans", () => {
  const monitor = read("src/lib/tron-monitor.server.ts");
  assert(monitor.includes("SCAN_OVERLAP_MS"));
  assert(monitor.includes("RECONCILIATION_WINDOW_MS"));
  assert(monitor.includes("earliestReconciliationTimestamp"));
  assert(monitor.includes("checkpointAfter.last_scanned_at"));
  assert(!monitor.includes("last_scanned_at: new Date(latestTs || Date.now()).toISOString()"));
  assert(monitor.includes("TRON_MONITOR_SCAN"));
  for (const field of ["scan_from", "scan_to", "events_found", "latest_event_time", "checkpoint_before", "checkpoint_after"]) {
    assert(monitor.includes(field));
  }
});

test("delayed indexed payments can reconcile recently expired invoices by blockchain timestamp", () => {
  const monitor = read("src/lib/tron-monitor.server.ts");
  const billing = read("src/lib/billing.server.ts");
  assert(monitor.includes('.in("status", ["PENDING", "PAYMENT_DETECTED", "CONFIRMING", "EXPIRED"])'));
  assert(billing.includes("sentAt > expiredAt"));
  assert(billing.includes('status = "LATE_PAYMENT"'));
  assert(billing.includes('classification = "EXACT_MATCH"'));
  assert(billing.includes("activatePaidInvoice(invoice.id"));
});

test("tx hash trace validates TronGrid event then uses the same classifier path", () => {
  const monitor = read("src/lib/tron-monitor.server.ts");
  const adminFns = read("src/lib/admin.functions.ts");
  const adminData = read("src/lib/admin-data.server.ts");
  const route = read("src/routes/admin.$section.tsx");
  assert(monitor.includes("export async function traceInvoiceTransaction"));
  assert(monitor.includes("/v1/transactions/${txHash.trim()}/events"));
  assert(monitor.includes("token contract does not match invoice"));
  assert(monitor.includes("recipient address does not match invoice"));
  assert(monitor.includes("amount does not match invoice"));
  assert(monitor.includes("recordTransfer(settings, contract, event)"));
  assert(adminFns.includes("traceInvoiceTransaction"));
  assert(adminData.includes("PAYMENT_TRANSACTION_TRACED"));
  assert(route.includes("Trace transaction"));
});

test("support Telegram setting is loaded server-side and opened with Telegram Mini App fallback", () => {
  const customer = read("src/lib/customer-data.server.ts");
  const funcs = read("src/lib/customer.functions.ts");
  const route = read("src/routes/mini-app.$section.tsx");
  assert(customer.includes("normalizeSupportTelegram"));
  assert(customer.includes("https://t.me/${telegramUsername}"));
  assert(funcs.includes("getSupportSettings"));
  assert(route.includes("support: await actions.getSupportSettings"));
  assert(route.includes("openTelegramLink"));
  assert(route.includes("window.open(support.telegramUrl"));
});

test("theme applicator immediately removes opposite theme and preferences merge safely", () => {
  const theme = read("src/lib/theme.ts");
  const root = read("src/routes/__root.tsx");
  const prefs = read("src/lib/preferences.server.ts");
  const mini = read("src/routes/mini-app.$section.tsx");
  const admin = read("src/routes/admin.$section.tsx");
  assert(theme.includes('classList.toggle("dark", theme === "dark")'));
  assert(theme.includes('classList.toggle("light", theme === "light")'));
  assert(theme.includes("Telegram?.WebApp?.colorScheme"));
  assert(root.includes("dataset.themePreference"));
  assert(prefs.includes("input.language === undefined"));
  assert(prefs.includes("input.theme === undefined"));
  assert(mini.includes("applyThemePreference(theme)"));
  assert(admin.includes("applyThemePreference(next.theme)"));
});

test("bot language persists before login and command replies use resolved language", () => {
  const bot = read("src/routes/api/public/telegram/webhook.ts");
  const migration = read("supabase/migrations/20260822123000_payment_monitor_trace_preferences_repair.sql");
  assert(migration.includes("bot_language_preferences"));
  assert(bot.includes("bot_language_preferences"));
  assert(bot.includes("await saveCustomerPreferences"));
  assert(bot.includes("bt(language, \"helpText\")"));
  assert(bot.includes("bt(language, \"cancelDone\")"));
  assert(bot.includes("bt(language, \"loginOpenMiniApp\")"));
  assert(bot.includes("bt(language, \"registrationOpenMiniApp\")"));
});

test("admin plan change/grant and premium emoji honor modal duration and reason", () => {
  const route = read("src/routes/admin.$section.tsx");
  const admin = read("src/lib/admin-data.server.ts");
  const billing = read("src/lib/billing.server.ts");
  assert(!route.includes("await changeCustomerPlan({ data"));
  assert(route.includes("action: input.mode === \"EXTEND\" ? \"EXTEND\" : input.mode === \"CHANGE\" ? \"CHANGE\" : \"GRANT\""));
  assert(admin.includes("source: input.action === \"GRANT\" ? \"FREE_GRANT\""));
  assert(admin.includes("old_expires_at"));
  assert(billing.includes("addonExpiryFromInput"));
  assert(billing.includes('input.action === "EXTEND"'));
  assert(billing.includes("PREMIUM_EMOJI_EXTENDED"));
});

test("notification settings persist and admin security actions are audited", () => {
  const migration = read("supabase/migrations/20260822123000_payment_monitor_trace_preferences_repair.sql");
  const db = read("src/lib/db.server.ts");
  const adminFns = read("src/lib/admin.functions.ts");
  const route = read("src/routes/admin.$section.tsx");
  assert(migration.includes("'notifications'"));
  assert(db.includes("payment_confirmation_notifications"));
  assert(adminFns.includes("auditAdminSecurityAction"));
  assert(route.includes("Save Notification Settings"));
  assert(route.includes("ADMIN_EMAIL_CHANGED"));
  assert(route.includes("ADMIN_PASSWORD_CHANGED"));
});

test("same active invoice remains DB/RPC idempotent and billing transaction insert is guarded", () => {
  const migration = read("supabase/migrations/20260821120000_real_usdt_invoices_premium_emoji_i18n.sql");
  const billing = read("src/lib/billing.server.ts");
  assert(migration.includes("billing_invoices_active_intent_idx"));
  assert(migration.includes("ACTIVE_INVOICE_EXISTS"));
  assert(migration.includes("RETURN existing"));
  assert(billing.includes("insertBillingTransaction"));
  assert(billing.includes(".eq(\"invoice_id\", invoice[\"id\"]"));
});

test("TRON mainnet USDT contract is official and monitor does not hide transfers behind a contract filter", () => {
  const billing = read("src/lib/billing.server.ts");
  const monitor = read("src/lib/tron-monitor.server.ts");
  const migration = read("supabase/migrations/20260822143000_fix_tron_usdt_contract_and_friendly_invoice_amounts.sql");
  assert(billing.includes('TRON_MAINNET_USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"'));
  assert(billing.includes("LEGACY_WRONG_TRON_USDT_CONTRACTS"));
  assert(!monitor.includes('url.searchParams.set("contract_address", contract)'));
  assert(monitor.includes('safeReject("WRONG_CONTRACT"'));
  assert(migration.includes("TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj"));
  assert(migration.includes("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"));
});

test("customer payment card copies full address and exact friendly amount and checks status server-side", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const funcs = read("src/lib/customer.functions.ts");
  const data = read("src/lib/customer-data.server.ts");
  assert(route.includes("function formatUsdtAmount"));
  assert(route.includes("replace(/\\.?0+$/, \"\")"));
  assert(route.includes("copyText(String(invoice.receiving_address"));
  assert(route.includes("copyText(exactAmount)"));
  assert(route.includes("checkInvoicePaymentStatus({ data: { auth, invoiceId: invoice.id } })"));
  assert(route.includes("VIEW ON TRONSCAN"));
  assert(route.includes("VIEW RECEIVING ADDRESS ON TRONSCAN"));
  assert(funcs.includes("export const checkInvoicePaymentStatus"));
  assert(data.includes("reconcileInvoicePayment(invoiceId)"));
});

test("new invoice allocation uses one-decimal friendly amounts before two-decimal fallback", () => {
  const migration = read("supabase/migrations/20260822143000_fix_tron_usdt_contract_and_friendly_invoice_amounts.sql");
  assert(migration.includes("suffix IN 1..9"));
  assert(migration.includes("suffix::numeric / 10"));
  assert(migration.includes("suffix IN 1..99"));
  assert(migration.includes("suffix::numeric / 100"));
  assert(migration.includes("unique_violation"));
});

test("mini app language applies immediately and contains real Chinese Russian Persian settings/payment strings", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const i18n = read("src/lib/mini-i18n.ts");
  assert(route.includes("applyMiniAppTranslations(appLanguage)"));
  assert(route.includes('setAppLanguage?.(nextLanguage, "settings-select", true)'));
  assert(i18n.includes("账户设置"));
  assert(i18n.includes("Настройки аккаунта"));
  assert(i18n.includes("تنظیمات حساب"));
  assert(i18n.includes("document.documentElement.dir = lang === \"fa\" ? \"rtl\" : \"ltr\""));
});

test("custom emoji preview path returns real Telegram media without exposing session material", () => {
  const telegram = read("src/lib/telegram-user-session.server.ts");
  const funcs = read("src/lib/customer.functions.ts");
  const data = read("src/lib/customer-data.server.ts");
  const route = read("src/routes/mini-app.$section.tsx");
  assert(telegram.includes("customEmojiPreviewViaUserSession"));
  assert(telegram.includes("GetCustomEmojiDocuments"));
  assert(telegram.includes("client.downloadMedia"));
  assert(telegram.includes("data_url"));
  assert(telegram.includes("access_hash"));
  assert(funcs.includes("getCustomEmojiPreview"));
  assert(data.includes("Premium Emoji add-on is required."));
  assert(route.includes("item.preview_url"));
  assert(route.includes('type: "custom_emoji"'));
  assert(route.includes("document_id: String(item.document_id)"));
  assert(!route.includes("fake document"));
});

test("mini app i18n covers major customer routes and restores English without reload", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const i18n = read("src/lib/mini-i18n.ts");
  for (const phrase of [
    "Add Telegram Session",
    "Group discovery started.",
    "DM campaign queued. Worker will process due jobs.",
    "Payment invoice created.",
    "Premium Emoji add-on is required.",
    "Telegram support is not configured.",
    "Custom emoji could not be loaded.",
    "CHECK PAYMENT STATUS",
  ]) {
    assert(i18n.includes(phrase), `missing source phrase: ${phrase}`);
  }
  for (const phrase of ["添加 Telegram 会话", "Поиск групп запущен", "کشف گروه شروع شد"]) {
    assert(i18n.includes(phrase), `missing translated phrase: ${phrase}`);
  }
  assert(i18n.includes("textOriginals = new WeakMap"));
  assert(i18n.includes("data-i18n-original"));
  assert(i18n.includes('document.documentElement.lang = lang'));
  assert(i18n.includes('document.documentElement.dir = lang === "fa" ? "rtl" : "ltr"'));
  assert(route.includes("applyMiniAppTranslations(appLanguage)"));
});

test("telegram bot uses selected language for commands, keyboards, and post-login mini app prompts", () => {
  const webhook = read("src/routes/api/public/telegram/webhook.ts");
  assert(webhook.includes("bot_language_preferences"));
  assert(webhook.includes("telegram_user_id: userId"));
  assert(webhook.includes("return normalizeLanguage(pending?.language ?? user.language_code)"));
  assert(webhook.includes('helpText: "请在这里注册或登录'));
  assert(webhook.includes('helpText: "Зарегистрируйтесь'));
  assert(webhook.includes('helpText: "اینجا ثبت'));
  assert(webhook.includes('unknownCommand: "我没有识别此命令'));
  assert(webhook.includes("async function openMiniAppKeyboard(language?: string | null"));
  assert(webhook.includes('bt(language, "openMiniAppButton")'));
  assert(webhook.includes("sendOpenMiniApp(chatId, language, bt(language, \"registrationOpenMiniApp\"), sessionToken)"));
  assert(webhook.includes("sendOpenMiniApp(chatId, language, bt(language, \"loginOpenMiniApp\"), result.token)"));
  assert(webhook.includes('await send(chatId, bt(language, "unknownCommand"))'));
  assert(!webhook.includes('bt("en", "miniAppMissing")'));
});

test("TGS custom emoji previews use Lottie media instead of Unicode-only fallback", () => {
  const pkg = read("package.json");
  const player = read("src/components/tgs-player.tsx");
  const telegram = read("src/lib/telegram-user-session.server.ts");
  const route = read("src/routes/mini-app.$section.tsx");
  assert(pkg.includes('"lottie-web"'));
  assert(pkg.includes('"pako"'));
  assert(player.includes('import { ungzip } from "pako"'));
  assert(player.includes('import("lottie-web")'));
  assert(player.includes("loadAnimation"));
  assert(player.includes("bytes[0] === 0x1f"));
  assert(telegram.includes('"tgs"'));
  assert(telegram.includes('"webm"'));
  assert(telegram.includes("emojiPreviewFormat"));
  assert(route.includes("preview_format: preview.format"));
  assert(route.includes('item.preview_format === "tgs"'));
  assert(route.includes("<TgsPlayer"));
  assert(route.includes('item.preview_format === "webm"'));
  assert(route.includes("<video"));
});

test("custom emoji document id stays in message entities through picker, draft, and send paths", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const customerData = read("src/lib/customer-data.server.ts");
  const worker = read("src/lib/campaign-worker.server.ts");
  const telegram = read("src/lib/telegram-user-session.server.ts");
  assert(route.includes('type: "custom_emoji"'));
  assert(route.includes("document_id: String(item.document_id)"));
  assert(route.includes("messageEntities"));
  assert(route.includes("hydrateEmojiPreviews"));
  assert(customerData.includes("message_entities"));
  assert(worker.includes("sendDirectViaUserSession"));
  assert(worker.includes("sendGroupViaUserSession"));
  assert(telegram.includes("MessageEntityCustomEmoji"));
  assert(telegram.includes("documentId"));
});

test("mini app has one authoritative language state and cannot render question-mark locale labels", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const i18n = read("src/lib/mini-i18n.ts");
  const styles = read("src/styles.css");
  assert(i18n.includes("MINI_LANGUAGE_LABELS"));
  assert(i18n.includes("简体中文"));
  assert(i18n.includes("Русский"));
  assert(i18n.includes("فارسی"));
  assert(!route.includes("????"));
  assert(route.includes("languageVersionRef"));
  assert(route.includes("manualLanguageRef"));
  assert(route.includes("currentLanguageRef"));
  assert(route.includes("I18N_STALE_UPDATE_IGNORED"));
  assert(route.includes("I18N_LOCALE_CHANGED"));
  assert(route.includes("I18N_LOCALE_SOURCE"));
  assert(route.includes("applyAuthoritativeLanguage(result.preferences.language"));
  assert(route.includes("telegramLanguageHint()"));
  assert(route.includes('saveCustomerPreferenceSettings({ data: { auth, language: nextLanguage } })'));
  assert(route.includes('saveCustomerPreferenceSettings({ data: { auth, theme } })'));
  assert(!route.includes("language, theme"));
  assert(styles.includes('"Noto Sans CJK SC"'));
  assert(styles.includes('"Noto Sans Arabic"'));
});

test("mini app translation restores English source after React renders a translated string", () => {
  const i18n = read("src/lib/mini-i18n.ts");
  assert(i18n.includes("sourceByTranslation"));
  assert(i18n.includes("sourceTextFor"));
  assert(i18n.includes("sourceByTranslation.get(trimmed)"));
  assert(i18n.includes("textOriginals.set(textNode, raw)"));
});

test("custom emoji preview diagnostics expose real media format without secrets", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const telegram = read("src/lib/telegram-user-session.server.ts");
  const player = read("src/components/tgs-player.tsx");
  assert(telegram.includes("CUSTOM_EMOJI_PREVIEW_REQUEST"));
  assert(telegram.includes("CUSTOM_EMOJI_PREVIEW_RESULT"));
  assert(telegram.includes("CUSTOM_EMOJI_PREVIEW_ERROR"));
  assert(telegram.includes("mime_type"));
  assert(telegram.includes("preview_format"));
  assert(telegram.includes("bytes: downloaded.length"));
  assert(!telegram.includes("session_string"));
  assert(route.includes("CUSTOM_EMOJI_RENDER_FORMAT"));
  assert(route.includes('format: "webm"'));
  assert(route.includes('format: "image"'));
  assert(player.includes("CUSTOM_EMOJI_RENDER_FORMAT"));
  assert(player.includes('format: "tgs"'));
  assert(player.includes("ungzip(bytes)"));
  assert(player.includes("JSON.parse(json)"));
  assert(player.includes("lottie.default ?? lottie"));
});

test("telegram premium capability is persisted and invalid auth becomes reconnect required", () => {
  const migration = read("supabase/migrations/20260822195500_premium_session_capability_and_preferred_emoji_session.sql");
  const telegram = read("src/lib/telegram-user-session.server.ts");
  const health = read("src/lib/telegram-session-health.server.ts");
  const customer = read("src/lib/customer-data.server.ts");
  assert(migration.includes("telegram_premium boolean"));
  assert(migration.includes("telegram_premium_checked_at"));
  assert(migration.includes("session_error_code"));
  assert(telegram.includes("userPremium(user)"));
  assert(telegram.includes("telegram_premium: userPremium"));
  assert(telegram.includes("health: \"RECONNECT_REQUIRED\""));
  assert(telegram.includes("session_error_code: \"AUTH_KEY_UNREGISTERED\""));
  assert(health.includes("RECONNECT_REQUIRED"));
  assert(health.includes("AUTH_KEY_UNREGISTERED"));
  assert(customer.includes("telegram_premium, telegram_premium_checked_at, session_error_code"));
});

test("premium emoji preview auto-selects healthy premium sessions and falls back on session failures", () => {
  const migration = read("supabase/migrations/20260822195500_premium_session_capability_and_preferred_emoji_session.sql");
  const customer = read("src/lib/customer-data.server.ts");
  const funcs = read("src/lib/customer.functions.ts");
  assert(migration.includes("premium_emoji_session_mode"));
  assert(migration.includes("preferred_premium_emoji_connection_id"));
  assert(customer.includes("premiumEmojiPreviewCandidates"));
  assert(customer.includes("preferred_premium_emoji_connection_id"));
  assert(customer.includes("telegram_premium === true"));
  assert(customer.includes("sessionLevelPreviewFailure"));
  assert(customer.includes("CUSTOM_EMOJI_PREVIEW_SESSION_FAILED"));
  assert(customer.includes("preview_connection_id"));
  assert(funcs.includes("setPreferredPremiumEmojiSession"));
  assert(funcs.includes("connectionId?: string | null"));
});

test("premium emoji preview session is separate from campaign sending session validation", () => {
  const customer = read("src/lib/customer-data.server.ts");
  const route = read("src/routes/mini-app.$section.tsx");
  assert(customer.includes("validateSendingSessionForCustomEmoji"));
  assert(customer.includes("This linked Telegram account requires Telegram Premium to send this custom emoji."));
  assert(customer.includes("await checkUserSession(ctx, String(connection.id))"));
  assert(route.includes("Preview uses a healthy linked Telegram session"));
  assert(route.includes("Sending account:"));
  assert(route.includes("Telegram Premium required"));
  assert(route.includes("SET AS PREMIUM EMOJI SESSION"));
  assert(route.includes("AUTO PREMIUM EMOJI SESSION"));
});
