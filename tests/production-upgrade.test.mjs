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
  assert(admin.includes('action: input.unlimited ? "CUSTOM_UNLIMITED_GRANTED" : "PLAN_GRANTED"'));
});

test("paid plans activate only after payment confirmation", () => {
  const customer = read("src/lib/customer-data.server.ts");
  const admin = read("src/lib/admin-data.server.ts");
  const request = customer.slice(customer.indexOf("export async function requestPayment"), customer.length);
  assert(request.includes('status: "PENDING"'));
  assert(request.includes("throw new Error(\"Free plans are assigned automatically or by an administrator.\")"));
  const confirm = admin.slice(admin.indexOf("export async function adminUpdateTransaction"), admin.indexOf("export async function adminSubscriptionAction"));
  assert(confirm.includes('if (status === "CONFIRMED" && tx.plan_id)'));
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

test("public billing reads active public DB plans and hides private plans", () => {
  const customer = read("src/lib/customer-data.server.ts");
  const ui = read("src/routes/mini-app.$section.tsx");
  const billing = customer.slice(customer.indexOf("export async function billing"), customer.indexOf("export async function requestPayment"));
  assert(billing.includes('.eq("is_active", true)'));
  assert(billing.includes('.eq("is_public", true)'));
  assert(ui.includes("20 sessions max") || ui.includes("hard max"));
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
