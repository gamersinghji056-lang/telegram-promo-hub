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

test("temporary notices are auto-cleared without reload", () => {
  const src = read("src/routes/mini-app.$section.tsx");
  assert(src.includes("window.setTimeout(() => setNotice(\"\"), 5000)"));
  assert(src.includes("window.setTimeout(() => setError(\"\"), 5000)"));
});
