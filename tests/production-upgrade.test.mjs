import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("WRITABLE check does not send and SENDABLE check does", () => {
  const src = read("src/lib/telegram-user-session.server.ts");
  const writable = src.slice(
    src.indexOf("export async function verifyGroupWritableViaUserSession"),
    src.indexOf("export async function testGroupSendableViaUserSession"),
  );
  const sendable = src.slice(
    src.indexOf("export async function testGroupSendableViaUserSession"),
    src.indexOf("export async function searchPublicGroupsViaUserSession"),
  );
  assert(!writable.includes("sendMessage("));
  assert(sendable.includes('sendMessage(entity, { message: "hey" })'));
});

test("category types default to NW_NS and include WRITABLE/SENDABLE", () => {
  const migration = read("supabase/migrations/20260819090000_writable_sendable_session_health_profile.sql");
  assert(migration.includes("DEFAULT 'NW_NS'"));
  assert(migration.includes("'NW_NS', 'WRITABLE', 'SENDABLE'"));
});

test("Group Promotion uses saved category members without writable re-filter", () => {
  const src = read("src/lib/customer-data.server.ts");
  const createCampaign = src.slice(src.indexOf("export async function createCampaign"), src.indexOf("export async function updateCampaign"));
  assert(createCampaign.includes(".from(\"group_category_members\")"));
  assert(!createCampaign.includes(".eq(\"can_send_messages\", true)"));
  assert(!createCampaign.includes(".eq(\"writable_status\", \"WRITABLE\")"));
  assert(createCampaign.includes('status: "PENDING"'));
});

test("profile name update is limited to customers.name", () => {
  const src = read("src/lib/customer-data.server.ts");
  const fn = src.slice(src.indexOf("export async function updateAccountName"), src.indexOf("export async function changeAccountPassword"));
  assert(fn.includes('.from("customers")'));
  assert(fn.includes("name: trimmed"));
  assert(!fn.includes("telegram_connections"));
  assert(!fn.includes("audience_contacts"));
});

test("auto session checks use eligible sessions and sequential fallback", () => {
  const src = read("src/lib/customer-data.server.ts");
  const fn = src.slice(src.indexOf("async function runAutoGroupChecks"), src.indexOf("export async function verifyWritableGroups"));
  assert(fn.includes("eligibleTenantSessions"));
  assert(fn.includes("for (const session of sessions)"));
  assert(fn.includes('status === "SENDABLE"'));
  assert(fn.includes('status === "WRITABLE"'));
  assert(fn.includes("definitiveGroupStatus(status)"));
});

test("Verify Unknown joins then runs real writable and sendable checks", () => {
  const src = read("src/lib/customer-data.server.ts");
  const fn = src.slice(src.indexOf("export async function verifyWritableGroups"), src.indexOf("export async function testWritableGroups"));
  assert(fn.includes("unresolvedGroupFilter()"));
  assert(fn.includes("joinIfRequired: input.joinIfRequired"));
  assert(fn.includes('mode: "WRITABLE"'));
  assert(fn.includes('mode: "SENDABLE"'));
});

test("Unknown is not silently converted to success", () => {
  const src = read("src/lib/customer-data.server.ts");
  const fn = src.slice(src.indexOf("async function runAutoGroupChecks"), src.indexOf("export async function verifyWritableGroups"));
  assert(fn.includes('status === "UNKNOWN" || status === "JOIN_REQUIRED" ? null : false'));
  assert(!fn.includes('status === "UNKNOWN") result.writable'));
  assert(!fn.includes('status === "UNKNOWN") result.sendable'));
});

test("category check UI uses independent busy states", () => {
  const src = read("src/routes/mini-app.$section.tsx");
  assert(src.includes('"check-writable"'));
  assert(src.includes('"check-sendable"'));
  assert(src.includes('"verify-unknown"'));
  assert(!src.includes('"test-category-writable-groups"'));
  const writableButton = src.slice(src.indexOf('actionBusy === "check-writable"'), src.indexOf('actionBusy === "check-sendable"'));
  assert(!writableButton.includes('actionBusy === "check-sendable"'));
});

test("Category Save does not call Telegram testing and validates persisted statuses", () => {
  const src = read("src/lib/customer-data.server.ts");
  const fn = src.slice(src.indexOf("export async function saveGroupCategory"), src.indexOf("export async function deleteGroupCategory"));
  assert(!fn.includes("testWritableGroups("));
  assert(!fn.includes("testSendableGroups("));
  assert(fn.includes('group.can_send_messages === true && group.writable_status === "WRITABLE"'));
  assert(fn.includes('group.sendable_status === "SENDABLE"'));
  assert(!fn.includes('throw new Error("Select at least one approved group.")'));
  assert(fn.includes("if (finalIds.length)"));
  const route = read("src/routes/mini-app.$section.tsx");
  assert(route.includes('disabled={!name || categorySaveBusy}'));
});

test("affected Mini App loaders fetch independent data in parallel", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  for (const section of [
    '"groups-find": async',
    '"groups-approved": async',
    '"dm-create": async',
    '"group-create": async',
    '"group-categories": async',
    "settings: async",
  ]) {
    const start = route.indexOf(section);
    assert(start > -1, `missing loader ${section}`);
    const block = route.slice(start, start + 800);
    assert(block.includes("Promise.all"), `loader ${section} should parallelize independent reads`);
  }
});

test("folder export persists the exportable subset instead of failing every mixed selection", () => {
  const src = read("src/lib/customer-data.server.ts");
  const fn = src.slice(src.indexOf("export async function createApprovedGroupFolderLink"), src.indexOf("export async function revokeApprovedGroupFolderLink"));
  assert(fn.includes("const candidateExportRows = rows.filter"));
  assert(fn.includes("const exportRows = selected.exportRows"));
  assert(!fn.includes("if (exportRows.length !== rows.length)"));
  assert(fn.includes("const includedGroups = exportRows.map"));
  assert(fn.includes("skipped_group_count: rows.length - exportRows.length"));
});

test("folder export can fall back to the linked session with the largest exportable subset", () => {
  const src = read("src/lib/customer-data.server.ts");
  const fn = src.slice(src.indexOf("export async function createApprovedGroupFolderLink"), src.indexOf("export async function revokeApprovedGroupFolderLink"));
  assert(fn.includes("const sessions = await eligibleTenantSessions(ctx.tenantId)"));
  assert(fn.includes("const candidateSessions = ["));
  assert(fn.includes("candidateExportRows.length > selected.exportRows.length"));
  assert(fn.includes("used_fallback_connection"));
  assert(fn.includes("requested_connection_id"));
});

test("category create buttons do not run writable or sendable Telegram checks", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const helper = route.slice(route.indexOf("function openFilteredEditor"), route.indexOf("async function saveCategory"));
  assert(helper.includes('categoryType === "SENDABLE" ? sendableGroups : writableGroups'));
  assert(!helper.includes("testWritableGroups"));
  assert(!helper.includes("testSendableGroups"));
  const buttons = route.slice(route.indexOf('<Plus className="mr-2 size-4" /> CREATE CATEGORY'), route.indexOf("VERIFY UNKNOWN GROUPS"));
  assert(buttons.includes('onClick={() => openFilteredEditor("WRITABLE")}'));
  assert(buttons.includes('onClick={() => openFilteredEditor("SENDABLE")}'));
  assert(!buttons.includes("openCheckedEditor"));
  assert(!buttons.includes("CHECKING..."));
});

test("dedicated writable and sendable check actions remain separate from category creation", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const checkHelper = route.slice(route.indexOf("async function runSelectedCheck"), route.indexOf("async function checkOne"));
  assert(checkHelper.includes("testSendableGroups"));
  assert(checkHelper.includes("testWritableGroups"));
  assert(route.includes('onClick={() => runSelectedCheck("WRITABLE")}'));
  assert(route.includes('onClick={() => runSelectedCheck("SENDABLE")}'));
});

test("standalone Mini App error recovery does not force Return to bot", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const warning = route.slice(route.indexOf("function SessionWarning"), route.indexOf("function CustomerContent"));
  assert(warning.includes("isTelegramRuntime"));
  assert(warning.includes("Retry"));
  assert(warning.includes("Go to dashboard"));
  assert(warning.includes("isTelegramRuntime ? ("));
  assert(warning.includes("Open Telegram bot"));
  assert(!route.includes("Your session could not be verified. Return to the bot"));
});

test("order worker uses eager runtime entrypoint and campaign batching is tenant-fair", () => {
  const pkg = JSON.parse(read("package.json"));
  const worker = read("src/lib/campaign-worker.server.ts");
  assert.equal(pkg.scripts["start:order-worker"], "node workers/runtime-worker.mjs order-worker");
  assert(worker.includes("function fairCampaignBatch"));
  assert(worker.includes("CAMPAIGN_WORKER_CLAIM_SCAN_MULTIPLIER"));
  assert(worker.includes("details: { requested: batchLimit, candidates:"));
  assert(worker.includes('.eq("status", "QUEUED")'));
});

test("campaign rate limits use recoverable cooldown instead of campaign-wide pause", () => {
  const worker = read("src/lib/campaign-worker.server.ts");
  const flood = worker.slice(worker.indexOf('if (classification === "FLOOD")'), worker.indexOf('if (classification === "RESTRICTED"'));
  assert(worker.includes("function recoverableTelegramRetryAt"));
  assert(flood.includes('status: "QUEUED"'));
  assert(flood.includes("run_after: nextRun"));
  assert(flood.includes('restriction_status: "COOLDOWN"'));
  assert(flood.includes('status: "RUNNING", next_run_at: nextRun'));
  assert(!flood.includes('status: "PAUSED"'));
});

test("campaign aggregate recovery reads Supabase rows directly and repairs stale RUNNING campaigns", () => {
  const worker = read("src/lib/campaign-worker.server.ts");
  const counter = worker.slice(worker.indexOf("async function markCampaignCounts"), worker.indexOf("async function logCampaign"));
  assert(!counter.includes("campaign.data?."));
  assert(counter.includes('campaign?.type === "GROUP"'));
  assert(worker.includes("async function recoverStaleCampaignAggregates"));
  assert(worker.includes("const recovered = await recoverStaleCampaignAggregates(batchLimit)"));
});

test("group category summary is read-only and campaign worker applies sent-group proof", () => {
  const customer = read("src/lib/customer-data.server.ts");
  const summary = customer.slice(customer.indexOf("export async function groupWritabilitySummary"), customer.indexOf("type GroupCheckMode"));
  assert(!summary.includes("applySuccessfulSendWritableProof"));
  const worker = read("src/lib/campaign-worker.server.ts");
  assert(worker.includes('writable_status: "WRITABLE"'));
  assert(worker.includes('sendable_status: "SENDABLE"'));
});

test("discovery polling skips hidden tabs and prevents overlapping full reloads", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  const polling = route.slice(route.indexOf("const groupRunning = section === \"groups-find\""), route.indexOf("applyMiniAppTranslations(appLanguage)"));
  assert(polling.includes("document.hidden"));
  assert(polling.includes("pollInFlightRef.current"));
  assert(polling.includes('document.addEventListener("visibilitychange"'));
  assert(polling.includes("load(true, { quiet: true })"));
  assert(route.includes("shellFetchedAtRef"));
  assert(route.includes("const shouldRefreshShell = !options.quiet"));
});

test("dashboard avoids many independent count requests on mobile app load", () => {
  const src = read("src/lib/customer-data.server.ts");
  const dashboard = src.slice(src.indexOf("export async function dashboard"), src.indexOf("export async function accountProfile"));
  assert(!dashboard.includes("const count = async"));
  assert(!dashboard.includes("const countIn = async"));
  assert(dashboard.includes(".select(\"status, can_send_messages, writable_status, sendable_status\")"));
  assert(dashboard.includes(".select(\"status, type\")"));
  assert(dashboard.includes("tenantUsageDashboard(ctx.tenantId)"));
});

test("modal save state is local and guarded against stale async results", () => {
  const src = read("src/routes/mini-app.$section.tsx");
  assert(src.includes("categorySaveBusy"));
  assert(src.includes("categorySaveRun"));
  assert(src.includes("if (categorySaveRun.current !== runId) return"));
  assert(src.includes("if (categorySaveRun.current !== openRun) return"));
});

test("human log formatter shows group session raw RPC and human reason", () => {
  const worker = read("src/lib/campaign-worker.server.ts");
  assert(worker.includes("campaignFailureContext"));
  assert(worker.includes("group_title"));
  assert(worker.includes("session_account_name"));
  assert(worker.includes("raw_error: rpc.raw"));
  assert(worker.includes("human_reason: rpc.human"));
  const ui = read("src/routes/mini-app.$section.tsx");
  assert(ui.includes("function CampaignLogEntry"));
  assert(ui.includes("Telegram Error:"));
  assert(ui.includes("Classification:"));
  assert(ui.includes("Reason:"));
});

test("temporary notices are auto-cleared without reload", () => {
  const src = read("src/routes/mini-app.$section.tsx");
  assert(src.includes("window.setTimeout(() => setNotice(\"\"), 5000)"));
  assert(src.includes("window.setTimeout(() => setError(\"\"), 5000)"));
});

test("plan schema defines requested public plans and quota fields", () => {
  const migration = read("supabase/migrations/20260819120000_admin_billing_plan_controls.sql");
  for (const code of ["'TEST'", "'PLUS'", "'PRO'", "'ENTERPRISE'"]) assert(migration.includes(code));
  for (const field of [
    "max_connections",
    "max_active_campaigns",
    "max_saved_groups",
    "monthly_groups_found_limit",
    "monthly_audience_found_limit",
    "monthly_message_limit",
    "monthly_dm_message_limit",
    "max_categories",
    "monthly_writable_check_limit",
    "monthly_sendable_check_limit",
    "analytics_level",
    "scheduling_enabled",
    "session_health_level",
  ]) assert(migration.includes(field));
  assert(migration.includes("max_connections <= 20"));
  assert(migration.includes("CREATE TABLE IF NOT EXISTS public.monthly_usage"));
  assert(migration.includes("CREATE OR REPLACE FUNCTION public.increment_monthly_usage"));
});

test("TEST and Enterprise session limits are enforced server-side", () => {
  const helper = read("src/lib/entitlements.server.ts");
  const session = read("src/lib/telegram-user-session.server.ts");
  assert(helper.includes("export const HARD_SESSION_LIMIT = 20"));
  assert(helper.includes('code: "TEST"'));
  assert(helper.includes("max_connections: 1"));
  assert(helper.includes('code: "ENTERPRISE"'));
  assert(helper.includes("max_connections: HARD_SESSION_LIMIT"));
  assert(session.includes('assertEntitlement(ctx.tenantId, "max_connections"'));
});

test("campaign and discovery quotas are enforced server-side", () => {
  const customer = read("src/lib/customer-data.server.ts");
  const worker = read("src/lib/campaign-worker.server.ts");
  assert(customer.includes('"max_active_campaigns"'));
  assert(customer.includes('"monthly_groups_found_limit"'));
  assert(customer.includes('"monthly_audience_found_limit"'));
  assert(customer.includes('"monthly_message_limit"'));
  assert(customer.includes('"monthly_dm_message_limit"'));
  assert(customer.includes('"max_categories"'));
  assert(customer.includes('"monthly_writable_check_limit"'));
  assert(customer.includes('"monthly_sendable_check_limit"'));
  assert(worker.includes('"monthly_message_limit"'));
  assert(worker.includes('"monthly_dm_message_limit"'));
});

test("admin can grant manual and no-expiry plans including custom unlimited", () => {
  const admin = read("src/lib/admin-data.server.ts");
  assert(admin.includes("export async function adminGrantPlan"));
  assert(admin.includes('payment_status: "MANUAL"'));
  assert(admin.includes('input.duration === "NO_EXPIRY"'));
  assert(admin.includes('override_type: "UNLIMITED"'));
  assert(admin.includes('input.unlimited ? "CUSTOM_UNLIMITED_GRANTED"'));
  assert(admin.includes('input.action === "EXTEND" ? "PLAN_EXTENDED"'));
});

test("paid plans activate only after payment confirmation", () => {
  const customer = read("src/lib/customer-data.server.ts");
  const admin = read("src/lib/admin-data.server.ts");
  const billingEngine = read("src/lib/billing.server.ts");
  const request = customer.slice(customer.indexOf("export async function requestPayment"), customer.length);
  assert(billingEngine.includes('status: "PENDING"'));
  assert(request.includes("self_selected_free_plan"));
  assert(request.indexOf('if (Number(plan.price_usd ?? 0) <= 0)') < request.indexOf("return createInvoice"));
  const confirm = admin.slice(admin.indexOf("export async function adminUpdateTransaction"), admin.indexOf("export async function adminSubscriptionAction"));
  assert(confirm.includes("activatePaidInvoice"));
  assert(confirm.includes('payment_status: "PAID"'));
  assert(confirm.includes('action: status === "CONFIRMED" ? "PAYMENT_CONFIRMED" : "TRANSACTION_UPDATED"'));
});

test("expired paid plan falls back to TEST without deleting tenant data", () => {
  const helper = read("src/lib/entitlements.server.ts");
  const admin = read("src/lib/admin-data.server.ts");
  assert(helper.includes("expired ? await testPlan()"));
  const changePlan = admin.slice(admin.indexOf("export async function adminChangePlan"), admin.indexOf("export async function adminGrantPlan"));
  assert(!changePlan.includes('from("telegram_connections").delete'));
  assert(!changePlan.includes('from("discovered_groups").delete'));
  assert(!changePlan.includes('from("group_categories").delete'));
});

test("delete user performs tenant-level cleanup and admin writes require super admin", () => {
  const adminData = read("src/lib/admin-data.server.ts");
  const adminFns = read("src/lib/admin.functions.ts");
  assert(adminData.includes("export async function adminDeleteCustomer"));
  assert(adminData.includes('action: "USER_DELETED"'));
  assert(adminData.includes('.from("tenants").delete().eq("id", customer.tenant_id)'));
  const writeFunctions = ["grantCustomerPlan", "forceLogoutCustomer", "deleteCustomer", "updateSubscription", "resetUsage", "saveQuotaOverride", "sendAdminNotification"];
  for (const fn of writeFunctions) {
    const block = adminFns.slice(adminFns.indexOf(`export const ${fn}`), adminFns.indexOf("export const", adminFns.indexOf(`export const ${fn}`) + 1));
    assert(block.includes("assertSuperAdmin"));
  }
});

test("public billing reads only official active plans and hides legacy private plans", () => {
  const customer = read("src/lib/customer-data.server.ts");
  const billingEngine = read("src/lib/billing.server.ts");
  const ui = read("src/routes/mini-app.$section.tsx");
  const migration = read("supabase/migrations/20260819133000_registration_public_plan_cleanup.sql");
  const billing = customer.slice(customer.indexOf("export async function billing"), customer.indexOf("export async function requestPayment"));
  assert(billing.includes("officialPlans()"));
  assert(billingEngine.includes("OFFICIAL_PLAN_CODES"));
  assert(billingEngine.includes('.eq("is_active", true)'));
  assert(migration.includes("upper(code) IN ('FREE', 'BASIC', 'PREMIUM', 'STARTER', 'GROWTH', 'SCALE')"));
  assert(migration.includes("SET is_public = false"));
  assert(ui.includes("20-session maximum") || ui.includes("20 sessions max"));
  assert(ui.includes("CURRENT PLAN"));
  assert(ui.includes("UPGRADE"));
  assert(ui.includes("SELECT PLAN"));
});

test("admin navigation includes Usage and Notifications sections", () => {
  const shell = read("src/components/admin-shell.tsx");
  const route = read("src/routes/admin.$section.tsx");
  assert(shell.includes('"Usage"'));
  assert(shell.includes('"Notifications"'));
  assert(route.includes('"usage"'));
  assert(route.includes('"notifications"'));
  assert(route.includes("function UsageAdmin"));
  assert(route.includes("function NotificationsAdmin"));
});

test("admin login supports guarded first-admin registration", () => {
  const login = read("src/routes/admin.login.tsx");
  const funcs = read("src/lib/admin.functions.ts");
  const data = read("src/lib/admin-data.server.ts");
  const migration = read("supabase/migrations/20260819140000_single_super_admin_bootstrap.sql");
  assert(login.includes("signUp"));
  assert(login.includes("Confirm Password"));
  assert(login.includes("CREATE ADMIN ACCOUNT"));
  assert(login.includes("Admin registration is closed."));
  assert(login.includes('disabled={busy || (mode === "register" && registerDisabled)}'));
  assert(login.includes("adminMe({ headers })"));
  assert(funcs.includes("getAdminRegistrationStatus"));
  assert(data.includes('eq("role", "super_admin")'));
  assert(data.includes('if (error) throw new Error("FORBIDDEN")'));
  assert(migration.includes("user_roles_single_super_admin_idx"));
});

test("admin auth forwards Supabase bearer tokens with a timeout guard", () => {
  const attacher = read("src/integrations/supabase/auth-attacher.ts");
  const login = read("src/routes/admin.login.tsx");
  const route = read("src/routes/admin.$section.tsx");
  assert(attacher.includes("supabaseAuthHeaders"));
  assert(attacher.includes("Authorization: `Bearer ${token}`"));
  assert(attacher.includes("AUTH_LOOKUP_TIMEOUT_MS"));
  assert(attacher.includes("withAdminAuthTimeout"));
  assert(login.includes("withAdminAuthTimeout(supabase.auth.signInWithPassword"));
  assert(login.includes("adminMe({ headers })"));
  assert(route.includes("adminMe({ headers: await supabaseAuthHeaders() })"));
  assert(login.includes("supabase.auth.signOut()"));
  assert(login.includes("Admin sign-out cleanup timed out"));
  assert(login.includes("finally"));
  assert(login.includes("adminMe request started"));
  assert(login.includes("dashboard navigation completed"));
  assert(login.includes("does not have super admin access"));
  assert(read("src/integrations/supabase/auth-middleware.ts").includes("hasAuthorization"));
  assert(read("src/lib/admin.functions.ts").includes("adminMe received authenticated request"));
});

test("billing cards are DB-driven and do not fabricate usage", () => {
  const customer = read("src/lib/customer-data.server.ts");
  const ui = read("src/routes/mini-app.$section.tsx");
  const billing = customer.slice(customer.indexOf("export async function billing"), customer.indexOf("export async function requestPayment"));
  assert(!billing.includes(".in(\"code\""));
  assert(ui.includes("usage.counts?.sessions"));
  assert(ui.includes("usage.limits?.max_connections"));
  assert(ui.includes("used.toLocaleString()"));
  assert(ui.includes('return value === null || value === undefined ? "Unlimited"'));
  assert(!ui.includes("Math.random"));
  assert(!ui.includes("mock"));
});

test("public plan defaults display requested plan names and prices", () => {
  const helper = read("src/lib/entitlements.server.ts");
  const ui = read("src/routes/mini-app.$section.tsx");
  for (const code of ['code: "TEST"', 'code: "PLUS"', 'code: "PRO"', 'code: "ENTERPRISE"']) assert(helper.includes(code));
  for (const price of ["price_usd: 0", "price_usd: 20", "price_usd: 30", "price_usd: 50"]) assert(helper.includes(price));
  assert(ui.includes("planFeatures(plan)"));
  assert(ui.includes("20-session maximum"));
  assert(ui.includes('String(plan.code).toUpperCase() === "PRO"'));
});

test("registration page controls real settings and stats", () => {
  const route = read("src/routes/admin.$section.tsx");
  const admin = read("src/lib/admin-data.server.ts");
  const funcs = read("src/lib/admin.functions.ts");
  const shell = read("src/components/admin-shell.tsx");
  assert(shell.includes('"Registration"'));
  assert(route.includes('"registration"'));
  assert(route.includes("function RegistrationAdmin"));
  assert(route.includes("saveRegistration"));
  assert(admin.includes("export async function adminRegistration"));
  assert(admin.includes("registration_enabled"));
  assert(admin.includes("default_plan_code"));
  assert(admin.includes("default_duration_days"));
  assert(admin.includes("new_user_status"));
  assert(admin.includes("pendingApprovals"));
  assert(funcs.includes("export const getRegistration"));
  assert(funcs.includes("export const saveRegistration"));
});

test("admin-created customer uses server-side auth records and selected entitlement", () => {
  const admin = read("src/lib/admin-data.server.ts");
  const funcs = read("src/lib/admin.functions.ts");
  const create = admin.slice(admin.indexOf("export async function adminCreateCustomer"), admin.length);
  assert(create.includes("hashPassword(input.password)"));
  assert(create.includes('.from("tenants")'));
  assert(create.includes('.from("customers")'));
  assert(create.includes('.from("tenant_members")'));
  assert(create.includes('.from("subscriptions")'));
  assert(create.includes("tenant_entitlement_overrides"));
  assert(create.includes("An account with this email already exists."));
  assert(create.includes('await client.from("tenants").delete().eq("id", tenant.id)'));
  assert(funcs.includes("return admin.adminCreateCustomer(context.userId, data)"));
});

test("registration defaults use TEST and pending approval does not auto-login", () => {
  const auth = read("src/lib/customer-auth.server.ts");
  const webhook = read("src/routes/api/public/telegram/webhook.ts");
  assert(auth.includes('settings.default_plan_code ?? "TEST"'));
  assert(auth.includes("settings.default_duration_days"));
  assert(auth.includes('settings.new_user_status === "PENDING_APPROVAL"'));
  assert(auth.includes('throw new Error("Your account is pending admin approval.")'));
  assert(webhook.includes("Account created and pending admin approval."));
});

test("legacy plan cleanup does not delete subscriptions or payment history", () => {
  const migration = read("supabase/migrations/20260819133000_registration_public_plan_cleanup.sql");
  assert(!migration.includes("DELETE FROM public.subscriptions"));
  assert(!migration.includes("DELETE FROM public.billing_transactions"));
  assert(!migration.includes("DELETE FROM public.plans"));
  assert(migration.includes("UPDATE public.plans"));
  assert(migration.includes("is_public = false"));
});

test("admin-created custom plans do not appear in official customer upgrade billing", () => {
  const customer = read("src/lib/customer-data.server.ts");
  const admin = read("src/lib/admin-data.server.ts");
  const billingEngine = read("src/lib/billing.server.ts");
  const billing = customer.slice(customer.indexOf("export async function billing"), customer.indexOf("export async function requestPayment"));
  assert(billing.includes("officialPlans()"));
  assert(billingEngine.includes('["TEST", "PLUS", "PRO", "ENTERPRISE"]'));
  assert(admin.includes("is_public: plan[\"is_public\"] !== false"));
  assert(admin.includes("is_custom: plan[\"is_custom\"] === true"));
});

test("real USDT invoice schema enforces active intent, unique amounts, tx hash uniqueness and expiry", () => {
  const migration = read("supabase/migrations/20260821120000_real_usdt_invoices_premium_emoji_i18n.sql");
  assert(migration.includes("CREATE TYPE public.billing_invoice_status"));
  for (const status of ["PENDING", "PAYMENT_DETECTED", "CONFIRMING", "PAID", "EXPIRED", "CANCELLED", "UNDERPAID", "OVERPAID", "LATE_PAYMENT", "REVIEW_REQUIRED"]) {
    assert(migration.includes(`'${status}'`));
  }
  assert(migration.includes("billing_invoices_active_intent_idx"));
  assert(migration.includes("billing_invoices_active_amount_idx"));
  assert(migration.includes("billing_invoices_tx_hash_unique_idx"));
  assert(migration.includes("billing_transactions_tx_hash_unique_idx"));
  assert(migration.includes("now() + interval '10 minutes'"));
  assert(migration.includes("create_usdt_billing_invoice"));
  assert(migration.includes("pg_advisory_xact_lock"));
  assert(migration.includes("Customer replaced invoice"));
});

test("invoice engine uses exact payable amounts and does not activate from browser callbacks", () => {
  const billing = read("src/lib/billing.server.ts");
  assert(billing.includes("TRON_MAINNET_USDT_CONTRACT"));
  assert(billing.includes("payable_amount"));
  assert(billing.includes("ACTIVE_INVOICE_EXISTS"));
  assert(billing.includes("tronLinkUrl"));
  assert(billing.includes("classifyAndRecordPayment"));
  assert(billing.includes("Payment was sent after invoice expiry."));
  assert(billing.includes("This transaction has already been used.") || read("src/lib/admin-data.server.ts").includes("This transaction has already been used."));
  assert(!billing.includes("Math.random"));
});

test("TRON monitor is server-only, checkpointed, idempotent and scans confirmed USDT transfers", () => {
  const monitor = read("src/lib/tron-monitor.server.ts");
  const workers = read("src/lib/background-workers.server.ts");
  assert(monitor.includes("TRONGRID_API_KEY"));
  assert(monitor.includes("transactions/trc20"));
  assert(monitor.includes("only_confirmed"));
  assert(monitor.includes("contract_address"));
  assert(monitor.includes("blockchain_scan_checkpoints"));
  assert(monitor.includes("classifyAndRecordPayment"));
  assert(workers.includes("processTronUsdtPayments"));
  assert(workers.includes("Payment worker failed"));
});

test("admin payment settings use canonical wallet address and real TRON validation", () => {
  const billing = read("src/lib/billing.server.ts");
  const admin = read("src/lib/admin-data.server.ts");
  const ui = read("src/routes/admin.$section.tsx");
  assert(billing.includes("base58Decode"));
  assert(billing.includes("checksum(payload).equals"));
  assert(billing.includes("payload[0] !== 0x41"));
  assert(billing.includes("normalizePaymentSettings"));
  assert(admin.includes("PAYMENT_SETTINGS_UPDATED"));
  assert(admin.includes("Enter a valid TRON mainnet Base58 address."));
  assert(admin.includes("return adminSettings();"));
  assert(ui.includes("Save Payment Settings"));
  assert(ui.includes("Full checksum is verified on save"));
});

test("admin console replaces browser prompts with modal workflows", () => {
  const ui = read("src/routes/admin.$section.tsx");
  assert(!ui.includes("prompt("));
  assert(!ui.includes("confirm("));
  for (const token of ["PlanManagementModal", "PremiumEmojiModal", "PasswordResetModal", "DeleteCustomerModal", "PaymentActionModal", "QuotaOverrideModal"]) {
    assert(ui.includes(token));
  }
});

test("admin plan and subscription extension use current active expiry", () => {
  const admin = read("src/lib/admin-data.server.ts");
  assert(admin.includes("expiryFromExtension"));
  assert(admin.includes("Math.max(Date.now()"));
  assert(admin.includes('input.action === "EXTEND"'));
  assert(admin.includes("PLAN_EXTENDED"));
});

test("customer billing exposes upgrade-only plans, active invoice, Premium Emoji add-on and invoice polling", () => {
  const customer = read("src/lib/customer-data.server.ts");
  const funcs = read("src/lib/customer.functions.ts");
  const ui = read("src/routes/mini-app.$section.tsx");
  assert(customer.includes("officialPlans()"));
  assert(customer.includes("PLAN_RANK"));
  assert(customer.includes("requestPremiumEmojiPayment"));
  assert(customer.includes("activeInvoice"));
  assert(funcs.includes("getInvoiceStatus"));
  assert(ui.includes("Exact Payable Amount"));
  assert(ui.includes("COPY ADDRESS"));
  assert(ui.includes("OPEN TRONLINK"));
  assert(ui.includes("Payment History"));
  assert(ui.includes("Premium Emoji"));
});

test("paid invoice activation is idempotent and separates base plans from Premium Emoji", () => {
  const billing = read("src/lib/billing.server.ts");
  assert(billing.includes("activatePaidInvoice"));
  assert(billing.includes('.neq("status", "PAID")'));
  assert(billing.includes('paid.product_type === "PLAN"'));
  assert(billing.includes('paid.product_code === PREMIUM_EMOJI_CODE.toUpperCase()'));
  assert(billing.includes("tenant_addon_entitlements"));
  assert(billing.includes("does not buy Telegram Premium") || read("src/routes/mini-app.$section.tsx").includes("does not buy Telegram Premium"));
});

test("custom emoji entities are stored, validated and sent with GramJS formattingEntities", () => {
  const migration = read("supabase/migrations/20260821120000_real_usdt_invoices_premium_emoji_i18n.sql");
  const customer = read("src/lib/customer-data.server.ts");
  const telegram = read("src/lib/telegram-user-session.server.ts");
  const ui = read("src/routes/mini-app.$section.tsx");
  assert(migration.includes("message_entities jsonb"));
  assert(customer.includes("normalizeMessageEntities(input.message.entities ?? [], input.message.text ?? \"\")"));
  assert(customer.includes("message_entities: normalizedMessage.entities"));
  assert(telegram.includes("MessageEntityCustomEmoji"));
  assert(telegram.includes("GetCustomEmojiDocuments"));
  assert(telegram.includes("formattingEntities"));
  assert(telegram.includes("requires Telegram Premium"));
  assert(ui.includes("document_id"));
  assert(ui.includes("utf16Length"));
});

test("i18n and theme preferences support English, Chinese, Russian and Persian RTL", () => {
  const i18n = read("src/lib/i18n.ts");
  const prefs = read("src/lib/preferences.server.ts");
  const root = read("src/routes/__root.tsx");
  const bot = read("src/routes/api/public/telegram/webhook.ts");
  for (const lang of ["en", "zh-CN", "ru", "fa"]) assert(i18n.includes(lang));
  assert(i18n.includes("directionForLanguage"));
  assert(i18n.includes('language === "fa" ? "rtl"'));
  assert(prefs.includes("customer_preferences"));
  assert(prefs.includes("admin_preferences"));
  assert(root.includes("wpay-theme"));
  assert(root.includes("wpay-language"));
  assert(bot.includes("lang:zh-CN"));
  assert(bot.includes("persistBotLanguage"));
});

test("admin payments and customer detail expose invoice monitor and Premium Emoji controls", () => {
  const adminData = read("src/lib/admin-data.server.ts");
  const adminFns = read("src/lib/admin.functions.ts");
  const route = read("src/routes/admin.$section.tsx");
  assert(adminData.includes("tronMonitorHealth"));
  assert(adminData.includes("billing_invoices"));
  assert(adminData.includes("adminGrantPremiumEmoji"));
  assert(adminFns.includes("grantPremiumEmoji"));
  assert(route.includes("Blockchain Monitor"));
  assert(route.includes("Grant Premium Emoji"));
  assert(route.includes("Revoke Premium Emoji"));
  assert(route.includes("Recent Invoices"));
});
