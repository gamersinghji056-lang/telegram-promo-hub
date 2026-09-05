import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Telegram background worker runs discovery families independently", () => {
  const worker = read("src/lib/background-workers.server.ts");
  assert(worker.includes('name: "Group discovery"'));
  assert(worker.includes('name: "Audience discovery"'));
  assert(worker.includes('name: "Bulk join"'));
  assert(worker.includes('name: "Add Users"'));
  assert(worker.includes('name: "Growth collection"'));
  assert(worker.includes("task.running"));
  assert(worker.includes("setInterval(() => runTask(task)"));
  assert(!worker.includes("await processGroupDiscoveryJobs(Number(process.env[\"GROUP_DISCOVERY_BATCH_LIMIT\"] ?? 5));\n        await processAudienceDiscoveryJobs"));
});

test("discovery state uses durable server-side claims instead of UI lifetime", () => {
  const customer = read("src/lib/customer-data.server.ts");
  const migration = read("supabase/migrations/20260905120000_discovery_job_leases.sql");
  assert(customer.includes("claim_group_discovery_jobs"));
  assert(customer.includes("claim_audience_discovery_jobs"));
  assert(customer.includes("discoveryWorkerId(\"group\")"));
  assert(customer.includes("discoveryWorkerId(\"audience\")"));
  assert(customer.includes("withDiscoveryLeaseRelease"));
  assert(migration.includes("FOR UPDATE SKIP LOCKED"));
  assert(migration.includes("lease_owner"));
  assert(migration.includes("lease_expires_at"));
  assert(migration.includes("idx_group_discovery_states_worker_due"));
  assert(migration.includes("idx_audience_discovery_states_worker_due"));
});

test("recoverable discovery failures schedule retry without explicit pause or completion", () => {
  const customer = read("src/lib/customer-data.server.ts");
  assert(customer.includes("discoveryRetryDelay(error)"));
  assert(customer.includes("FLOOD_WAIT"));
  assert(customer.includes("DISCOVERY_RATE_LIMIT_RETRY_MS"));
  assert(customer.includes("audienceResultRetryDelay(groupResult)"));
  assert(customer.includes('if (!retryDelay) done.add(next);'));
  assert(customer.includes('status: "COMPLETED"'));
  assert(!customer.includes('status: "PAUSED",\n          last_error'));
});

test("group discovery caps new inserts to remaining quota instead of discarding a whole batch", () => {
  const customer = read("src/lib/customer-data.server.ts");
  const entitlements = read("src/lib/entitlements.server.ts");
  assert(entitlements.includes("export async function usageQuotaRemaining"));
  assert(customer.includes("usageQuotaRemaining"));
  assert(customer.includes("if (remaining !== null && added >= remaining) continue;"));
  assert(!customer.includes("rows.length,\n    \"Monthly group discovery limit reached.\""));
});

test("start pause and resume remain persisted server actions for every client", () => {
  const customer = read("src/lib/customer-data.server.ts");
  const fns = read("src/lib/customer.functions.ts");
  const route = read("src/routes/mini-app.$section.tsx");
  assert(customer.includes("export async function startGroupDiscovery"));
  assert(customer.includes("export async function pauseGroupDiscovery"));
  assert(customer.includes("export async function startAudienceDiscovery"));
  assert(customer.includes("export async function pauseAudienceDiscovery"));
  assert(customer.includes('status: "RUNNING"'));
  assert(customer.includes('status: "PAUSED"'));
  assert(fns.includes("startGroupDiscovery"));
  assert(fns.includes("pauseGroupDiscovery"));
  assert(fns.includes("startAudienceDiscovery"));
  assert(fns.includes("pauseAudienceDiscovery"));
  assert(route.includes("setNotice(\"Group discovery started.\")"));
  assert(route.includes("setNotice(\"Find Users started.\")"));
});

test("telegram-worker remains the documented owner of discovery queues", () => {
  const docs = read("RAILWAY_SERVICES.md");
  const role = read("src/lib/runtime-role.server.ts");
  const pkg = JSON.parse(read("package.json"));
  const entry = read("workers/runtime-worker.mjs");
  assert(docs.includes("telegram-worker"));
  assert(docs.includes("group discovery, audience discovery"));
  assert(role.includes('"telegram-worker"'));
  assert(role.includes('role === "telegram-worker"'));
  assert.equal(pkg.scripts["start:telegram-worker"], "node workers/runtime-worker.mjs telegram-worker");
  assert(entry.includes("process.env.MARK8BOT_RUNTIME_ROLE = role"));
  assert(entry.includes('await import("../.output/server/_ssr/ssr.mjs")'));
  assert(entry.includes("mark8bot_worker_health_server_started"));
});
