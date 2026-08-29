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
  const diagnostic = read("src/routes/api/internal/entity-send-test.ts");
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

test("sessions page uses compact real premium badge and no large premium text", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  assert(route.includes('row.telegram_premium === true'));
  assert(route.includes('aria-label="Telegram Premium"'));
  assert(route.includes("<Sparkles"));
  assert(!route.includes("Telegram Premium: {premiumLabel}"));
});

test("custom emoji picker groups packs and lazily hydrates more real previews", () => {
  const telegram = read("src/lib/telegram-user-session.server.ts");
  const route = read("src/routes/mini-app.$section.tsx");
  assert(telegram.includes("CustomEmojiPack"));
  assert(telegram.includes("installedPacks"));
  assert(telegram.includes("featuredPacks"));
  assert(telegram.includes("searchPacks"));
  assert(telegram.includes("emojiPacksFromSets"));
  assert(telegram.includes("set_id"));
  assert(route.includes("emojiVisibleCount"));
  assert(route.includes("loadMoreEmoji"));
  assert(route.includes("onGridScroll"));
  assert(route.includes("allPacks.map"));
  assert(route.includes("items.map(renderEmojiButton)"));
  assert(route.includes("document_id: String(item.document_id)"));
  assert(!route.includes('>{item.free ? "Free" : "Premium"}</span>'));
});

test("custom emoji picker batches preview loading and does not show unicode fallback while loading", () => {
  const telegram = read("src/lib/telegram-user-session.server.ts");
  const customer = read("src/lib/customer-data.server.ts");
  const funcs = read("src/lib/customer.functions.ts");
  const route = read("src/routes/mini-app.$section.tsx");
  assert(telegram.includes("customEmojiPreviewsViaUserSession"));
  assert(telegram.includes("PREVIEW_BATCH_CONCURRENCY = 6"));
  assert(telegram.includes("previewCache"));
  assert(telegram.includes("CUSTOM_EMOJI_CACHE_HIT"));
  assert(telegram.includes("CUSTOM_EMOJI_FIRST_PAGE_MS"));
  assert(telegram.includes("options: { query?: string | null; tab?: string | null }"));
  assert(telegram.includes('const tab = query ? "search" : (options.tab ?? "recent")'));
  assert(customer.includes("customEmojiPreviewsViaUserSession"));
  assert(customer.includes("tab: input.tab ?? null"));
  assert(funcs.includes("getCustomEmojiPreviews"));
  assert(funcs.includes("tab?: string | null"));
  assert(route.includes("getCustomEmojiPreviews"));
  assert(route.includes("tab: nextTab"));
  assert(route.includes("emojiRequestRef"));
  assert(route.includes("selectedEmojiPackRef"));
  assert(route.includes("animate-pulse"));
  assert(route.includes("preview_unavailable ?"));
});

test("custom emoji pack switching uses compact icon strip and ignores stale responses", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  assert(route.includes("selectEmojiPack"));
  assert(route.includes("CUSTOM_EMOJI_PACK_SWITCH_MS"));
  assert(route.includes("if (requestId !== emojiRequestRef.current"));
  assert(route.includes("String(activePack?.id) === String(pack.id)"));
  assert(route.includes("size-10 shrink-0"));
  assert(route.includes("Sparkles"));
  assert(route.includes("Loading more..."));
  assert(route.includes("window.setTimeout"));
});

test("telegram session operations are serialized and invalid auth stays out of candidates", () => {
  const telegram = read("src/lib/telegram-user-session.server.ts");
  const health = read("src/lib/telegram-session-health.server.ts");
  assert(telegram.includes("const sessionLocks = new Map"));
  assert(telegram.includes("withSessionLock"));
  assert(telegram.includes("SESSION_LOCK_ACQUIRED"));
  assert(telegram.includes("SESSION_LOCK_RELEASED"));
  assert(telegram.includes("markInvalidAuth"));
  assert(telegram.includes("session_error_code: \"AUTH_KEY_UNREGISTERED\""));
  assert(health.includes("errorCode !== \"AUTH_KEY_UNREGISTERED\""));
});

test("campaign message entities are canonical from composer through worker send", () => {
  const entities = read("src/lib/message-entities.ts");
  const route = read("src/routes/mini-app.$section.tsx");
  const customer = read("src/lib/customer-data.server.ts");
  const worker = read("src/lib/campaign-worker.server.ts");
  const telegram = read("src/lib/telegram-user-session.server.ts");
  const diagnostic = read("src/routes/api/internal/entity-send-test.ts");
  assert(entities.includes("export type CanonicalMessageEntity"));
  assert(entities.includes("export function utf16Offset"));
  assert(entities.includes("replaceTextAndShiftEntities"));
  assert(entities.includes("reconcileEntitiesAfterTextChange"));
  assert(route.includes("replaceTextAndShiftEntities"));
  assert(route.includes("reconcileEntitiesAfterTextChange"));
  assert(!route.includes("if ((props.entities ?? []).length) props.setEntities([])"));
  assert(route.includes("selectedEmojiIds"));
  assert(customer.includes("message_entities: normalizedMessage.entities"));
  assert(worker.includes("message_entities"));
  assert(worker.includes("normalizeMessageEntities("));
  assert(telegram.includes("MessageEntityBold"));
  assert(telegram.includes("MessageEntityItalic"));
  assert(telegram.includes("MessageEntityUnderline"));
  assert(telegram.includes("MessageEntityStrike"));
  assert(telegram.includes("MessageEntitySpoiler"));
  assert(telegram.includes("MessageEntityTextUrl"));
  assert(telegram.includes("MessageEntityCustomEmoji"));
  assert(telegram.includes("TELEGRAM_SEND_ENTITIES"));
  assert(diagnostic.includes("CAMPAIGN_WORKER_KEY"));
  assert(diagnostic.includes("sendAndRefetchViaUserSession"));
  assert(diagnostic.includes('"me"'));
  assert(diagnostic.includes("WPAY entity test"));
});

test("custom emoji previews use persistent cache before Telegram downloads", () => {
  const telegram = read("src/lib/telegram-user-session.server.ts");
  const migration = read("supabase/migrations/20260822234500_custom_emoji_preview_cache.sql");
  assert(migration.includes("CREATE TABLE IF NOT EXISTS public.custom_emoji_preview_cache"));
  assert(migration.includes("document_id text PRIMARY KEY"));
  assert(migration.includes("expires_at"));
  assert(telegram.includes("cachedPersistentPreviews"));
  assert(telegram.includes("storePersistentPreview"));
  assert(telegram.includes(".from(\"custom_emoji_preview_cache\")"));
  assert(telegram.includes("CUSTOM_EMOJI_CACHE_HIT"));
});

test("custom emoji catalog uses persistent stale while revalidate cache", () => {
  const telegram = read("src/lib/telegram-user-session.server.ts");
  const migration = read("supabase/migrations/20260823093000_custom_emoji_catalog_cache.sql");
  assert(migration.includes("CREATE TABLE IF NOT EXISTS public.custom_emoji_catalog_cache"));
  assert(migration.includes("catalog jsonb NOT NULL"));
  assert(migration.includes("stale_at"));
  assert(migration.includes("expires_at"));
  assert(telegram.includes("catalogCacheKey"));
  assert(telegram.includes("readCatalogCache"));
  assert(telegram.includes("writeCatalogCache"));
  assert(telegram.includes("refreshCustomEmojiCatalogCache"));
  assert(telegram.includes("CUSTOM_EMOJI_CATALOG_CACHE_HIT"));
  assert(telegram.includes("CUSTOM_EMOJI_CATALOG_CACHE_MISS"));
  assert(telegram.includes("CUSTOM_EMOJI_CATALOG_REFRESH_MS"));
});

test("admin telegram diagnostics are super-admin server-only fixed-target tests", () => {
  const adminFns = read("src/lib/admin.functions.ts");
  const adminData = read("src/lib/admin-data.server.ts");
  const adminRoute = read("src/routes/admin.$section.tsx");
  const worker = read("src/lib/campaign-worker.server.ts");
  assert(adminFns.includes("runTelegramDiagnostic"));
  assert(adminFns.includes("await admin.assertSuperAdmin(context.userId)"));
  assert(adminData.includes('process.env["TELEGRAM_TEST_DM_TARGET"]'));
  assert(adminData.includes('process.env["TELEGRAM_TEST_GROUP_TARGET"]'));
  assert(adminData.includes("TELEGRAM_DIAGNOSTIC_DM_SENT"));
  assert(adminData.includes("TELEGRAM_DIAGNOSTIC_GROUP_SENT"));
  assert(adminData.includes("listCustomEmojiCatalogViaUserSession"));
  assert(adminRoute.includes("Telegram Diagnostics"));
  assert(adminRoute.includes("TEST MODE"));
  assert(adminRoute.includes("dmTargetConfigured"));
  assert(!adminRoute.includes("TELEGRAM_TEST_DM_TARGET"));
  assert(!adminRoute.includes("TELEGRAM_TEST_GROUP_TARGET"));
  assert(worker.includes("sendDiagnosticCampaignMessage"));
  assert(worker.includes("campaignMessage(campaign.id"));
});

test("controlled telegram diagnostics preserve canonical entities and returned Telegram metadata", () => {
  const adminData = read("src/lib/admin-data.server.ts");
  const worker = read("src/lib/campaign-worker.server.ts");
  const telegram = read("src/lib/telegram-user-session.server.ts");
  assert(adminData.includes('"bold"'));
  assert(adminData.includes('"italic"'));
  assert(adminData.includes('"underline"'));
  assert(adminData.includes('"strikethrough"'));
  assert(adminData.includes('"spoiler"'));
  assert(adminData.includes('"text_url"'));
  assert(adminData.includes('"custom_emoji"'));
  assert(adminData.includes("customEmojiDocumentId"));
  assert(adminData.includes("utf16Length"));
  assert(worker.includes("TELEGRAM_DIAGNOSTIC_ENTITY_RELOAD"));
  assert(worker.includes("sendDirectViaUserSession"));
  assert(worker.includes("sendGroupViaUserSession"));
  assert(telegram.includes("summarizeSentMessage"));
  assert(telegram.includes("MessageEntityCustomEmoji"));
  assert(telegram.includes("document_id"));
  assert(worker.includes("sentEntities"));
});

test("canonical entities use text_url, preserve legacy text_link and keep 64-bit custom emoji ids lossless", () => {
  const entities = read("src/lib/message-entities.ts");
  const telegram = read("src/lib/telegram-user-session.server.ts");
  const route = read("src/routes/mini-app.$section.tsx");
  const diagnostic = read("src/routes/api/internal/entity-send-test.ts");
  assert(entities.includes('type === "text_link") return "text_url"'));
  assert(entities.includes('"text_url"'));
  assert(!telegram.includes("Number(entity.document_id)"));
  assert(!telegram.includes("parseInt(entity.document_id"));
  assert(telegram.includes("bigInt(String(entity.document_id))"));
  assert(telegram.includes("new Api.MessageEntityTextUrl"));
  assert(telegram.includes('type: "text_url"'));
  assert(route.includes('["text_url", "Link"]'));
  assert(diagnostic.includes("sendAndRefetchViaUserSession"));
  assert(diagnostic.includes("refetched"));
});

test("custom emoji picker uses Mini App lifetime cache and visible-only TGS playback", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const player = read("src/components/tgs-player.tsx");
  assert(route.includes("emojiCatalogCacheRef"));
  assert(route.includes("emojiCatalogCacheKey"));
  assert(route.includes("cachedCatalog"));
  assert(player.includes("IntersectionObserver"));
  assert(player.includes("if (!visible) return"));
  assert(player.includes("animation?.destroy()"));
});

test("campaign composer renders a Telegram-style preview from canonical entities", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  assert(route.includes("function TelegramMessagePreview"));
  assert(route.includes("function RenderedTelegramText"));
  assert(route.includes("normalizeMessageEntities(entities ?? [], text ?? \"\")"));
  assert(route.includes("font-bold"));
  assert(route.includes("italic"));
  assert(route.includes("underline underline-offset-2"));
  assert(route.includes("line-through"));
  assert(route.includes("function TelegramSpoiler"));
  assert(route.includes("Reveal spoiler"));
  assert(route.includes("text-sky-700 underline"));
  assert(route.includes("Telegram Preview"));
  assert(!route.includes("function Preview({ message"));
});

test("composer custom emoji preview uses media cache without changing canonical payload", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const customer = read("src/lib/customer-data.server.ts");
  assert(route.includes("composerPreviewCacheRef"));
  assert(route.includes("getCustomEmojiPreviews"));
  assert(route.includes("function TelegramCustomEmoji"));
  assert(route.includes("<TgsPlayer"));
  assert(route.includes("<video"));
  assert(route.includes("<img"));
  assert(route.includes("Premium emoji preview unavailable"));
  assert(route.includes("document_id: String(item.document_id)"));
  assert(route.includes("composerPreviewCacheRef.current[String(item.document_id)] = preview"));
  assert(!customer.includes("preview_url"));
});

test("DM and Group campaign composers share the same visual preview and canonical send payload", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  assert.equal((route.match(/<MessageForm/g) ?? []).length, 2);
  assert.equal((route.match(/<TelegramMessagePreview/g) ?? []).length, 1);
  assert(route.includes("entities={messageEntities}"));
  assert(route.includes("setEntities={setMessageEntities}"));
  assert(route.includes("entities: messageEntities"));
  assert(route.includes("reconcileEntitiesAfterTextChange"));
  assert(route.includes("replaceTextAndShiftEntities"));
});

test("DM promotion audience filters are server-side and preserved through filtered selection", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const funcs = read("src/lib/customer.functions.ts");
  const data = read("src/lib/customer-data.server.ts");
  assert(data.includes('AudienceUsernameFilter = "ALL" | "WITH_USERNAME" | "WITHOUT_USERNAME"'));
  assert(data.includes('AudienceActivityFilter = "ALL" | "ACTIVE_RECENTLY" | "AROUND_MONTH" | "LONG_TIME_AGO"'));
  assert(data.includes("last_seen_at.gte"));
  assert(data.includes("presence_status.in.(ONLINE,RECENTLY)"));
  assert(data.includes("presence_status.in.(WITHIN_WEEK,WITHIN_MONTH)"));
  assert(data.includes("activityFilter: input.audience_filters?.activityFilter"));
  assert(funcs.includes("usernameFilter?: \"ALL\" | \"WITH_USERNAME\" | \"WITHOUT_USERNAME\""));
  assert(route.includes("Audience Filters"));
  assert(route.includes("Matching Users"));
  assert(route.includes("usernameFilter: result.usernameFilter"));
  assert(route.includes("activityFilter: result.activityFilter"));
  assert(route.includes("audience_filters"));
});

test("approved groups create real Telegram addlist links with stored management state", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const funcs = read("src/lib/customer.functions.ts");
  const data = read("src/lib/customer-data.server.ts");
  const telegram = read("src/lib/telegram-user-session.server.ts");
  const migration = read("supabase/migrations/20260825090000_approved_group_telegram_folder_links.sql");
  assert(route.includes("CREATE SHAREABLE FOLDER LINK"));
  assert(route.includes("CREATE SHAREABLE LINK"));
  assert(route.includes("Select All"));
  assert(route.includes("Using:"));
  assert(route.includes("Reconnect required"));
  assert(route.includes("View Included Groups"));
  assert(route.includes("revokeApprovedGroupFolderLink"));
  assert(funcs.includes("getApprovedGroupFolderEligibility"));
  assert(funcs.includes("createApprovedGroupFolderLink"));
  assert(data.includes("Only your own approved groups can be exported."));
  assert(data.includes("approvedGroupFolderEligibility"));
  assert(data.includes("folderLinkEligibilityViaUserSession"));
  assert(data.includes("Telegram shared-folder limit reached for this account."));
  assert(data.includes("No selected approved groups are exportable from this Telegram account."));
  assert(!data.includes("lastLimitError"));
  assert(telegram.includes("Api.chatlists.ExportChatlistInvite"));
  assert(telegram.includes("Api.chatlists.DeleteExportedInvite"));
  assert(telegram.includes("Api.InputChatlistDialogFilter"));
  assert(telegram.includes("folderLinkEligibilityViaUserSession"));
  const eligibility = telegram.slice(telegram.indexOf("export async function folderLinkEligibilityViaUserSession"), telegram.indexOf("async function nextChatlistFilterId"));
  assert(!eligibility.includes("getDialogs({ limit: 500 })"));
  assert(eligibility.includes("client.getInputEntity"));
  assert(telegram.includes("Private/inaccessible"));
  assert(telegram.includes("Not exportable by Telegram"));
  assert(!telegram.includes("wpay/addlist"));
  assert(migration.includes("CREATE TABLE IF NOT EXISTS public.telegram_folder_links"));
  assert(migration.includes("revoked_at timestamptz"));
  assert(migration.includes("ENABLE ROW LEVEL SECURITY"));
});

test("approved folder modal has compact scrollable create flow and backend validation", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const data = read("src/lib/customer-data.server.ts");
  assert(route.includes("BACK"));
  assert(route.includes("h-[92dvh]"));
  assert(route.includes("overflow-y-auto"));
  assert(route.includes("env(safe-area-inset-bottom)"));
  assert(route.includes("healthyFolderConnections"));
  assert(route.includes("Using: select connected account"));
  assert(route.includes("setFolderSelection(approvedGroups.map((g: any) => g.id))"));
  assert(route.includes("for (const group of approvedGroups)"));
  assert(!route.includes("Loading folder eligibility..."));
  assert(!route.includes("Checking eligibility..."));
  assert(route.includes("Reconnect required"));
  assert(data.includes("folderLinkEligibilityViaUserSession"));
  assert(data.includes("Telegram shared-folder limit reached for this account."));
  assert(data.includes("No selected approved groups are exportable from this Telegram account."));
  const folderCreate = data.slice(data.indexOf("export async function createApprovedGroupFolderLink"), data.indexOf("export async function revokeApprovedGroupFolderLink"));
  assert(!folderCreate.includes("assertEntitlement"));
});

test("Add Users page reuses audience filters and persists tracked job state", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const funcs = read("src/lib/customer.functions.ts");
  const data = read("src/lib/customer-data.server.ts");
  const migration = read("supabase/migrations/20260825210000_add_users_jobs.sql");
  const shell = read("src/components/mini-app-shell.tsx");
  assert(shell.includes('"add-users": "audience"'));
  assert(route.includes('"add-users"'));
  assert(route.includes("function AddUsersPage"));
  assert(route.includes("usernameFilter"));
  assert(route.includes("activityFilter"));
  assert(route.includes("selectAudienceIds"));
  assert(route.includes("Matching Users"));
  assert(route.includes("Select All Matching"));
  assert(route.includes("Telegram Session"));
  assert(route.includes("Reconnect Required"));
  assert(route.includes("RESOLVE / CHECK"));
  assert(route.includes("ADD USERS TO GROUP"));
  assert(route.includes("ADD USERS TO CHANNEL"));
  assert(route.includes("PENDING"));
  assert(route.includes("Processing"));
  assert(route.includes("SUCCESSFUL"));
  assert(route.includes("FAILED"));
  assert(route.includes("Pause"));
  assert(route.includes("Resume"));
  assert(route.includes("Cancel"));
  assert(route.includes("Recent Add Users Jobs"));
  assert(funcs.includes("getAddUsersState"));
  assert(funcs.includes("checkAddUsersDestination"));
  assert(funcs.includes("startAddUsersJob"));
  assert(funcs.includes("controlAddUsersJob"));
  assert(data.includes("addUsersState"));
  assert(data.includes("startAddUsersJob"));
  assert(data.includes("controlAddUsersJob"));
  assert(data.includes("processAddUsersJobs"));
  assert(data.includes(".eq(\"tenant_id\", ctx.tenantId)"));
  assert(data.includes(".eq(\"customer_id\", ctx.customerId)"));
  assert(migration.includes("CREATE TABLE IF NOT EXISTS public.add_users_jobs"));
  assert(migration.includes("CREATE TABLE IF NOT EXISTS public.add_users_job_results"));
  assert(migration.includes("ENABLE ROW LEVEL SECURITY"));
});

test("Add Users credits are independent, success-only and invoice activated once", () => {
  const migration = read("supabase/migrations/20260826120000_add_users_credit_wallet.sql");
  const billing = read("src/lib/billing.server.ts");
  const data = read("src/lib/customer-data.server.ts");
  const route = read("src/routes/mini-app.$section.tsx");
  const adminData = read("src/lib/admin-data.server.ts");
  const adminRoute = read("src/routes/admin.$section.tsx");
  assert(migration.includes("CREATE TABLE IF NOT EXISTS public.tenant_add_users_credits"));
  assert(migration.includes("free_trial_used integer NOT NULL DEFAULT 0 CHECK (free_trial_used BETWEEN 0 AND 5)"));
  assert(migration.includes("add_users_credit_ledger_result_unique"));
  assert(migration.includes("add_users_credit_ledger_invoice_unique"));
  assert(migration.includes("consume_add_users_credit"));
  assert(migration.includes("grant_add_users_credits"));
  assert(billing.includes("ADD_USERS_CREDITS_CODE"));
  assert(billing.includes("ADD_USERS_CREDITS_PRICE_USD = 5"));
  assert(billing.includes("ADD_USERS_CREDITS_QUANTITY = 1000"));
  assert(billing.includes('paid.product_code === ADD_USERS_CREDITS_CODE.toUpperCase()'));
  assert(data.includes("requireAddUsersCapacity(ctx.tenantId, ids.length)"));
  assert(data.includes('invite.status === "SUCCESSFUL"'));
  assert(data.includes("consumeSuccessfulAddUsersCredit"));
  assert(data.includes("Add Users credits exhausted"));
  assert(route.includes("ADD USERS CREDITS"));
  assert(route.includes("BUY / TOP UP"));
  assert(route.includes("Free trial remaining"));
  assert(adminData.includes("adminAdjustAddUsersCredits"));
  assert(adminRoute.includes("Grant Add Users Credits"));
  assert(adminRoute.includes("Add Users Credit History"));
});

test("Add Users MTProto flow detects destination permissions and handles invite errors safely", () => {
  const telegram = read("src/lib/telegram-user-session.server.ts");
  const worker = read("src/lib/background-workers.server.ts");
  const i18n = read("src/lib/mini-i18n.ts");
  assert(telegram.includes("checkAddUsersDestinationViaUserSession"));
  assert(telegram.includes("addUserToDestinationViaUserSession"));
  assert(telegram.includes("destinationType"));
  assert(telegram.includes("Selected session must be joined/member of that destination."));
  assert(telegram.includes("Selected session must be channel admin with invite users permission."));
  assert(telegram.includes("Api.messages.AddChatUser"));
  assert(telegram.includes("Api.channels.InviteToChannel"));
  assert(telegram.includes("USER_PRIVACY_RESTRICTED"));
  assert(telegram.includes("Privacy restricted"));
  assert(telegram.includes("USER_ALREADY_PARTICIPANT"));
  assert(telegram.includes("Already participant"));
  assert(telegram.includes("FLOOD_WAIT"));
  assert(telegram.includes("PEER_FLOOD"));
  assert(telegram.includes("Session invalid"));
  assert(worker.includes("processAddUsersJobs"));
  assert(worker.includes("ADD_USERS_BATCH_LIMIT"));
  for (const phrase of ["Add Users", "User Filters", "Select Telegram Session", "ADD USERS TO GROUP", "ADD USERS TO CHANNEL", "Recent Add Users Jobs"]) {
    assert(i18n.includes(phrase), `missing Add Users i18n phrase ${phrase}`);
  }
});

test("folder export reuses the selected account's suitable chatlist and records exact MTProto failures", () => {
  const funcs = read("src/lib/customer.functions.ts");
  const data = read("src/lib/customer-data.server.ts");
  const telegram = read("src/lib/telegram-user-session.server.ts");
  const create = telegram.slice(telegram.indexOf("export async function createShareableFolderLinkViaUserSession"), telegram.indexOf("export async function revokeShareableFolderLinkViaUserSession"));
  const serverCreate = data.slice(data.indexOf("export async function createApprovedGroupFolderLink"), data.indexOf("export async function revokeApprovedGroupFolderLink"));

  assert(funcs.includes("connectionId: string; groupIds: string[]"));
  assert(serverCreate.includes("await requireConnection(ctx, connectionId)"));
  assert(!serverCreate.includes("defaultHealthyConnection"));
  assert(serverCreate.includes("preferredFilterId"));
  assert(create.includes("SUITABLE_EXISTING_CHATLIST"));
  assert(create.includes('filterTitle(filter) === "WPAY Groups"'));
  assert(create.includes("const filterCreated = !reusable"));
  assert(create.includes("if (!reusable || ownedReusable)"));
  assert(create.includes('method: "chatlists.ExportChatlistInvite"'));
  assert(create.includes("errorCode: errorCode(error)"));
  assert(create.includes("https:\\/\\/t\\.me\\/addlist\\/"));
  assert(data.includes('.from("telegram_folder_links")'));
});

test("Add Users mobile workflow keeps configuration before selection and results", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const page = route.slice(route.indexOf("function AddUsersPage"), route.indexOf("function CampaignsPage"));
  const filters = page.indexOf('t("User Filters")');
  const session = page.indexOf('t("Telegram Session")');
  const destination = page.indexOf('t("Paste Group or Channel Link")');
  const credits = page.indexOf('t("Add Users Credits")');
  const controls = page.indexOf('t("Select All Matching")');
  const selectedUsers = page.indexOf('t("Selected Users")');
  const action = page.indexOf('t(actionLabel)');
  const results = page.indexOf('t("Current Add Users Job")');
  assert(filters < session && session < destination && destination < credits);
  assert(credits < controls && controls < selectedUsers && selectedUsers < action && action < results);
  assert(page.includes("overflow-x-clip"));
  assert(page.includes("min-[340px]:grid-cols-3"));
  assert(page.includes("whitespace-normal break-words"));
  assert(!page.includes('sticky bottom-[calc(var(--miniapp-bottom-nav-height'));
  assert(page.includes('["ALL", "PENDING", "PROCESSING", "SUCCESSFUL", "FAILED"]'));
});

test("Add Users destination remains visible and controlled across checks", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const page = route.slice(route.indexOf("function AddUsersPage"), route.indexOf("function CampaignsPage"));
  assert(route.includes("text-foreground caret-foreground opacity-100"));
  assert(route.includes("[-webkit-text-fill-color:currentColor]"));
  assert(page.includes('name="add-users-destination"'));
  assert(page.includes('value={destination}'));
  assert(page.includes('setDestination(event.currentTarget.value)'));
  assert(page.includes('appearance-none text-foreground caret-cyan-500'));
  assert(page.includes('!destination.trim()'));
  assert(!page.includes('setDestination("")'));
});

test("folder modal surfaces persisted Telegram results and safe real failures above selection", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const data = read("src/lib/customer-data.server.ts");
  const telegram = read("src/lib/telegram-user-session.server.ts");
  const modal = route.slice(route.indexOf("function GroupList"), route.indexOf("function GroupRows"));
  const session = modal.indexOf("Telegram Session");
  const loading = modal.indexOf("Creating Telegram folder link…");
  const existing = modal.indexOf("Created Links");
  const quickSelection = modal.indexOf("Up to {limit.toLocaleString()}");
  const groupList = modal.indexOf("approvedGroups.map");
  assert(session < loading && loading < existing && existing < quickSelection && quickSelection < groupList);
  assert(modal.includes("setFolderResult(created)"));
  assert(modal.includes("setFolderError(message)"));
  assert(modal.includes("COPY LINK"));
  assert(modal.includes("VIEW INCLUDED GROUPS"));
  assert(modal.includes("activeFolderLinks"));
  assert(modal.includes("pb-[calc(5.5rem+env(safe-area-inset-bottom))]"));
  assert(!modal.includes('setModal("");\n                          await reload();'));
  assert(data.includes("safeFolderLinkFailure"));
  assert(data.includes("CHATLISTS_TOO_MUCH:"));
  assert(data.includes("FILTER_INCLUDE_EMPTY:"));
  assert(data.includes("PERSISTENCE_FAILED:"));
  assert(data.includes("revokeShareableFolderLinkViaUserSession"));
  assert(telegram.includes("INVALID_EXPORTED_INVITE"));
  assert(telegram.includes("/^https:\\/\\/t\\.me\\/addlist"));
});

test("approved group primary actions intentionally distinguish import and folder export", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const groupList = route.slice(route.indexOf("function GroupList"), route.indexOf("function GroupRows"));
  assert(groupList.includes('<Button onClick={() => setModal("ADD")}'));
  assert(groupList.includes('<Button onClick={() => setModal("IMPORT")}'));
  assert(groupList.includes('<Plus className="mr-2 size-4" /> IMPORT GROUPS'));
  assert(groupList.includes("border-primary/25 bg-primary/10"));
});
