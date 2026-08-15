import { db, logSystem } from "./db.server";
import type { MessagePayload } from "./telegram.server";
import { sendDirectViaUserSession, sendGroupViaUserSession } from "./telegram-user-session.server";

const DEFAULT_BATCH_LIMIT = 10;
const DEFAULT_SEND_DELAY_MS = 2_000;
const MAX_ATTEMPTS = 3;

type JobRow = {
  id: string;
  tenant_id: string;
  campaign_id: string;
  connection_id: string | null;
  job_type: "GROUP" | "DM";
  target_id: string;
  attempts: number;
};

function sendDelayMs() {
  const raw = Number(process.env["CAMPAIGN_SEND_DELAY_MS"] ?? DEFAULT_SEND_DELAY_MS);
  return Number.isFinite(raw) && raw >= 1000 ? raw : DEFAULT_SEND_DELAY_MS;
}

function classifyTelegramError(error: string) {
  const lower = error.toLowerCase();
  if (
    lower.includes("flood") ||
    lower.includes("too many requests") ||
    lower.includes("retry after")
  ) {
    return "FLOOD";
  }
  if (
    lower.includes("forbidden") ||
    lower.includes("blocked") ||
    lower.includes("not enough rights")
  ) {
    return "RESTRICTED";
  }
  if (lower.includes("chat not found") || lower.includes("user not found")) return "PERMANENT";
  if (lower.includes("entity_unavailable")) return "ENTITY_UNAVAILABLE";
  if (lower.includes("not_writable")) return "NOT_WRITABLE";
  return "TEMPORARY";
}

function backoffMinutes(attempts: number) {
  return Math.min(60, 2 ** Math.max(attempts, 1));
}

async function campaignMessage(campaignId: string, tenantId: string) {
  const { data } = await db()
    .from("campaigns")
    .select("id, tenant_id, status, type, message, connection_id, min_delay_seconds, max_delay_seconds, cycle_delay_minutes")
    .eq("id", campaignId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) throw new Error("Campaign not found.");
  if (data.status !== "RUNNING") throw new Error("Campaign is not running.");
  return data as {
    id: string;
    status: string;
    type: string;
    message: MessagePayload;
    connection_id: string | null;
    min_delay_seconds?: number | null;
    max_delay_seconds?: number | null;
    cycle_delay_minutes?: number | null;
  };
}

function campaignDelayMs(campaign: { min_delay_seconds?: number | null; max_delay_seconds?: number | null }) {
  const min = Math.max(1, Number(campaign.min_delay_seconds ?? 0));
  const max = Math.max(min, Number(campaign.max_delay_seconds ?? min));
  const seconds = min + Math.floor(Math.random() * (max - min + 1));
  return Math.max(sendDelayMs(), seconds * 1000);
}

async function verifyConnection(tenantId: string, connectionId: string | null) {
  if (!connectionId) throw new Error("Campaign has no selected sending session.");
  const { data } = await db()
    .from("telegram_connections")
    .select("id, status, restriction_status, cooldown_until")
    .eq("id", connectionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) throw new Error("Sending session not found.");
  if (data.status !== "CONNECTED") throw new Error("Sending session is not connected.");
  if (data.cooldown_until && new Date(data.cooldown_until as string) > new Date()) {
    throw new Error("Sending session is cooling down.");
  }
  if (["RESTRICTED", "REQUIRES_ACTION"].includes(String(data.restriction_status ?? ""))) {
    throw new Error("Sending session requires attention.");
  }
}

async function resolveTarget(job: JobRow) {
  const client = db();
  if (job.job_type === "GROUP") {
    const { data } = await client
      .from("campaign_groups")
      .select("id, status, discovered_groups(id, title, username, telegram_group_id, access_hash, entity_type, status, can_send_messages, writable_status)")
      .eq("id", job.target_id)
      .eq("tenant_id", job.tenant_id)
      .maybeSingle();
    const group = Array.isArray(data?.discovered_groups)
      ? data?.discovered_groups[0]
      : data?.discovered_groups;
    if (!data || !group) throw new Error("Group target not found.");
    if (!["APPROVED", "JOINED"].includes(String(group.status)))
      throw new Error("Group is not approved.");
    if (group.can_send_messages === false || group.writable_status === "NOT_WRITABLE") {
      throw new Error("NOT_WRITABLE: selected session cannot post to this group/channel.");
    }
    return {
      kind: "GROUP" as const,
      target: {
        telegramGroupId: group.telegram_group_id ? Number(group.telegram_group_id) : null,
        username: group.username as string | null,
        accessHash: group.access_hash as string | null,
        entityType: group.entity_type as string | null,
      },
      targetTable: "campaign_groups",
      label: group.username ? `@${group.username}` : group.title,
    };
  }

  const { data } = await client
    .from("campaign_recipients")
    .select("id, status, telegram_user_id, audience_contacts(id, eligibility, contact_count, username, access_hash, entity_status)")
    .eq("id", job.target_id)
    .eq("tenant_id", job.tenant_id)
    .maybeSingle();
  const contact = Array.isArray(data?.audience_contacts)
    ? data?.audience_contacts[0]
    : data?.audience_contacts;
  if (!data || !contact) throw new Error("Recipient target not found.");
  if (contact.eligibility !== "OPTED_IN") throw new Error("Recipient is not opted in.");
  if ((contact.contact_count ?? 0) > 0) throw new Error("Recipient was already contacted.");
  if (contact.entity_status === "ENTITY_UNAVAILABLE" || (!contact.username && !contact.access_hash)) {
    throw new Error("ENTITY_UNAVAILABLE: recipient has no resolvable Telegram entity.");
  }
  return {
    kind: "DM" as const,
    target: {
      telegramUserId: Number(data.telegram_user_id),
      username: contact.username as string | null,
      accessHash: contact.access_hash as string | null,
    },
    targetTable: "campaign_recipients",
    contactId: contact.id,
    label: String(data.telegram_user_id),
  };
}

async function markCampaignCounts(campaignId: string, tenantId: string) {
  const client = db();
  const [campaign, sent, failed, remaining] = await Promise.all([
    client
      .from("campaigns")
      .select("id, type, status, cycle_delay_minutes, cycles_completed")
      .eq("id", campaignId)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    client
      .from("campaign_jobs")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("status", "SENT"),
    client
      .from("campaign_jobs")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", ["FAILED", "SKIPPED", "EXCLUDED", "ENTITY_UNAVAILABLE", "NOT_WRITABLE"]),
    client
      .from("campaign_jobs")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status", ["QUEUED", "PROCESSING", "HELD", "PAUSED"]),
  ]);
  const completed = sent.count ?? 0;
  const failedCount = failed.count ?? 0;
  const update: Record<string, unknown> = {
    completed_count: completed,
    failed_count: failedCount,
    updated_at: new Date().toISOString(),
  };
  if ((remaining.count ?? 0) === 0 && campaign.data?.type === "GROUP" && campaign.data?.status === "RUNNING") {
    const nextRun = new Date(
      Date.now() + Math.max(1, Number(campaign.data.cycle_delay_minutes ?? 20)) * 60_000,
    ).toISOString();
    update["cycles_completed"] = Number(campaign.data.cycles_completed ?? 0) + 1;
    update["last_run_at"] = new Date().toISOString();
    update["next_run_at"] = nextRun;
    await client
      .from("campaign_jobs")
      .update({
        status: "QUEUED",
        attempts: 0,
        run_after: nextRun,
        locked_at: null,
        started_at: null,
        completed_at: null,
        last_error: null,
      })
      .eq("campaign_id", campaignId)
      .eq("tenant_id", tenantId)
      .eq("job_type", "GROUP");
  } else if ((remaining.count ?? 0) === 0) {
    update["status"] = failedCount > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
    update["completed_at"] = new Date().toISOString();
  }
  await client.from("campaigns").update(update).eq("id", campaignId).eq("tenant_id", tenantId);
}

async function logCampaign(
  job: JobRow,
  level: string,
  message: string,
  details: Record<string, unknown> = {},
) {
  await db()
    .from("campaign_logs")
    .insert({
      tenant_id: job.tenant_id,
      campaign_id: job.campaign_id,
      level,
      message,
      details: { job_id: job.id, job_type: job.job_type, ...details },
    });
}

async function failJob(job: JobRow, error: string) {
  const classification = classifyTelegramError(error);
  const final =
    ["PERMANENT", "ENTITY_UNAVAILABLE", "NOT_WRITABLE"].includes(classification) ||
    job.attempts + 1 >= MAX_ATTEMPTS;
  const nextRun = new Date(Date.now() + backoffMinutes(job.attempts + 1) * 60_000).toISOString();
  const status =
    classification === "ENTITY_UNAVAILABLE"
      ? "ENTITY_UNAVAILABLE"
      : classification === "NOT_WRITABLE"
        ? "NOT_WRITABLE"
        : final
          ? "FAILED"
          : "QUEUED";
  await db()
    .from("campaign_jobs")
    .update({
      status,
      attempts: job.attempts + 1,
      last_error: error,
      run_after: final ? new Date().toISOString() : nextRun,
      completed_at: final ? new Date().toISOString() : null,
    })
    .eq("id", job.id);
  await logCampaign(job, final ? "ERROR" : "WARNING", error, { classification });
  if (classification === "ENTITY_UNAVAILABLE" || classification === "NOT_WRITABLE") {
    const targetTable = job.job_type === "GROUP" ? "campaign_groups" : "campaign_recipients";
    await db()
      .from(targetTable)
      .update({ status, error, sent_at: null })
      .eq("id", job.target_id)
      .eq("tenant_id", job.tenant_id);
  }

  if (classification === "FLOOD" && job.connection_id) {
    const until = new Date(Date.now() + backoffMinutes(job.attempts + 1) * 60_000).toISOString();
    await db()
      .from("telegram_connections")
      .update({ restriction_status: "COOLDOWN", cooldown_until: until, error_message: error })
      .eq("id", job.connection_id)
      .eq("tenant_id", job.tenant_id);
    await db()
      .from("campaigns")
      .update({ status: "PAUSED", updated_at: new Date().toISOString() })
      .eq("id", job.campaign_id)
      .eq("tenant_id", job.tenant_id);
    await db()
      .from("campaign_jobs")
      .update({ status: "PAUSED" })
      .eq("campaign_id", job.campaign_id)
      .eq("status", "QUEUED");
  }

  if (classification === "RESTRICTED" && job.connection_id) {
    await db()
      .from("telegram_connections")
      .update({ restriction_status: "RESTRICTED", status: "ERROR", error_message: error })
      .eq("id", job.connection_id)
      .eq("tenant_id", job.tenant_id);
  }
}

async function processJob(job: JobRow) {
  const client = db();
  const { data: locked } = await client
    .from("campaign_jobs")
    .update({
      status: "PROCESSING",
      locked_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "QUEUED")
    .select("*")
    .maybeSingle();
  if (!locked) return { skipped: true };

  try {
    const campaign = await campaignMessage(job.campaign_id, job.tenant_id);
    await verifyConnection(job.tenant_id, job.connection_id ?? campaign.connection_id);
    const target = await resolveTarget(job);
    const connectionId = job.connection_id ?? campaign.connection_id ?? "";
    if (target.kind === "GROUP") {
      await sendGroupViaUserSession(job.tenant_id, connectionId, target.target, campaign.message);
    } else {
      await sendDirectViaUserSession(job.tenant_id, connectionId, target.target, campaign.message);
    }

    await client
      .from("campaign_jobs")
      .update({ status: "SENT", completed_at: new Date().toISOString(), last_error: null })
      .eq("id", job.id);
    await client
      .from(target.targetTable)
      .update({ status: "SENT", sent_at: new Date().toISOString(), error: null })
      .eq("id", job.target_id);
    if (job.job_type === "DM" && target.contactId) {
      await client
        .from("audience_contacts")
        .update({
          status: "CONTACTED",
          last_contacted_at: new Date().toISOString(),
          last_campaign_id: job.campaign_id,
        })
        .eq("id", target.contactId)
        .eq("tenant_id", job.tenant_id);
      const { data: contact } = await client
        .from("audience_contacts")
        .select("contact_count")
        .eq("id", target.contactId)
        .maybeSingle();
      await client
        .from("audience_contacts")
        .update({ contact_count: Number(contact?.contact_count ?? 0) + 1 })
        .eq("id", target.contactId)
        .eq("tenant_id", job.tenant_id);
    }
    if (job.connection_id) {
      await client
        .from("telegram_connections")
        .update({
          last_used_at: new Date().toISOString(),
          cooldown_until: new Date(Date.now() + campaignDelayMs(campaign)).toISOString(),
          restriction_status: "NONE",
          error_message: null,
        })
        .eq("id", job.connection_id)
        .eq("tenant_id", job.tenant_id);
    }
    await logCampaign(job, "INFO", "Message sent.", { target: target.label });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Campaign job failed.";
    await failJob(job, message);
    return { failed: true, error: message };
  } finally {
    await markCampaignCounts(job.campaign_id, job.tenant_id);
  }
}

export async function processCampaignJobs(limit = DEFAULT_BATCH_LIMIT) {
  const batchLimit = Math.max(1, Math.min(limit, 50));
  const { data: jobs, error } = await db()
    .from("campaign_jobs")
    .select("*")
    .eq("status", "QUEUED")
    .lte("run_after", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(batchLimit);
  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const job of (jobs ?? []) as unknown as JobRow[]) {
    const result = await processJob(job);
    if (result.sent) sent += 1;
    else if (result.failed) failed += 1;
    else skipped += 1;
  }
  await logSystem({
    action: "CAMPAIGN_WORKER_RUN",
    details: { requested: batchLimit, sent, failed, skipped },
  });
  return { processed: jobs?.length ?? 0, sent, failed, skipped };
}
