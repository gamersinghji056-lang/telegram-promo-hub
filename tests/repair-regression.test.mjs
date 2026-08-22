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
