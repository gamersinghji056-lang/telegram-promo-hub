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
  assert(route.includes("setAppLanguage?.(normalizeMiniLanguage(language))"));
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
