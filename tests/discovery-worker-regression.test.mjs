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
  assert(customer.includes("discoveryKeepsWorkPending(error)"));
  assert(customer.includes("FLOOD_WAIT"));
  assert(customer.includes("DISCOVERY_RATE_LIMIT_RETRY_MS"));
  assert(customer.includes("audienceResultRetryDelay(groupResult)"));
  assert(customer.includes("if (!keepPending) done.add(next);"));
  assert(customer.includes('status: "COMPLETED"'));
});

test("group discovery caps new inserts to remaining quota instead of discarding a whole batch", () => {
  const customer = read("src/lib/customer-data.server.ts");
  const entitlements = read("src/lib/entitlements.server.ts");
  assert(entitlements.includes("export async function usageQuotaRemaining"));
  assert(customer.includes("usageQuotaRemaining"));
  assert(customer.includes("if (remaining !== null && added >= remaining) continue;"));
  assert(!customer.includes("rows.length,\n    \"Monthly group discovery limit reached.\""));
});

test("audience discovery caps new inserts to remaining quota instead of discarding a whole source group", () => {
  const customer = read("src/lib/customer-data.server.ts");
  assert(customer.includes("const remainingAudienceQuota = await usageQuotaRemaining"));
  assert(customer.includes("summary.usersFound >= remainingAudienceQuota"));
  assert(customer.includes("groupResult.usersFound += 1;"));
  assert(!customer.includes("result.users.length,\n        \"Monthly audience discovery limit reached.\""));
});

test("discovery workers do not process without a database lease when claim RPC is unavailable", () => {
  const customer = read("src/lib/customer-data.server.ts");
  assert(customer.includes('console.warn("GROUP_DISCOVERY_LEASE_UNAVAILABLE"'));
  assert(customer.includes('console.warn("AUDIENCE_DISCOVERY_LEASE_UNAVAILABLE"'));
  assert(!customer.includes('.from("group_discovery_states")\n      .select("*")\n      .eq("status", "RUNNING")'));
  assert(!customer.includes('.from("audience_discovery_states")\n      .select("*")\n      .eq("status", "RUNNING")'));
});

test("discovery workers fall back to another healthy linked session during background processing", () => {
  const customer = read("src/lib/customer-data.server.ts");
  assert(customer.includes("async function healthyDiscoveryConnection"));
  assert(customer.includes("return await requireConnection(ctx, preferredConnectionId);"));
  assert(customer.includes("return await defaultHealthyConnection(ctx);"));
  assert(customer.includes("const connection = await healthyDiscoveryConnection("));
  assert(customer.includes("state.connection_id as string | null"));
  assert(customer.includes("connection_id: connectionId"));
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

test("discovery screens quietly refresh running server-side state", () => {
  const route = read("src/routes/mini-app.$section.tsx");
  assert(route.includes('const groupRunning = section === "groups-find" && data?.discovery?.status === "RUNNING";'));
  assert(route.includes("const audienceRunning = section === \"dm-audience\" && data?.discovery?.state?.status === \"RUNNING\";"));
  assert(route.includes("load(true, { quiet: true })"));
  assert(route.includes("document.hidden"));
  assert(route.includes("pollInFlightRef.current"));
  assert(route.includes('label="Next Search"'));
  assert(route.includes("Recent Worker Errors"));
});

test("telegram-worker remains the documented owner of discovery queues", () => {
  const docs = read("RAILWAY_SERVICES.md");
  const role = read("src/lib/runtime-role.server.ts");
  const pkg = JSON.parse(read("package.json"));
  const entry = read("workers/runtime-worker.mjs");
  const worker = read("src/lib/background-workers.server.ts");
  assert(docs.includes("telegram-worker"));
  assert(docs.includes("group discovery, audience discovery"));
  assert(role.includes('"telegram-worker"'));
  assert(role.includes('role === "telegram-worker"'));
  assert.equal(pkg.scripts["start:telegram-worker"], "node workers/runtime-worker.mjs telegram-worker");
  assert(entry.includes("process.env.MARK8BOT_RUNTIME_ROLE = role"));
  assert(entry.includes('await import("../.output/server/_ssr/ssr.mjs")'));
  assert(entry.includes("mark8bot_worker_health_server_started"));
  assert(worker.includes("BACKGROUND_WORKER_TASK_STARTED"));
  assert(worker.includes("BACKGROUND_WORKER_TICK"));
});
