import { db, logSystem } from "./db.server";
import { assertUsageQuota, incrementMonthlyUsage } from "./entitlements.server";
import type { MessagePayload } from "./telegram.server";
import { sendDirectViaUserSession, sendGroupViaUserSession, type TelegramSendResult } from "./telegram-user-session.server";
import { classifyTelegramError as classifyRpcError } from "./telegram-errors.server";
import { entityDiagnostics, normalizeMessageEntities } from "./message-entities";

const DEFAULT_BATCH_LIMIT = 10;
const DEFAULT_SEND_DELAY_MS = 2_000;
const MAX_ATTEMPTS = 3;
const DEFAULT_CLAIM_SCAN_MULTIPLIER = 10;

type JobRow = {
  id: string;
  tenant_id: string;
  campaign_id: string;
  connection_id: string | null;
  job_type: "GROUP" | "DM";
  target_id: string;
  attempts: number;
};

export type DiagnosticTargetType = "DM" | "GROUP";

export type DiagnosticCampaignSendResult = {
  campaignId: string;
  targetType: DiagnosticTargetType;
  messageId: number | null;
  timestamp: string;
  senderSession: string;
  senderPremium: boolean | null;
  entityTypesSent: string[];
  customEmojiDocumentId: string | null;
  sentEntities: TelegramSendResult["entities"];
};

function sendDelayMs() {
  const raw = Number(process.env["CAMPAIGN_SEND_DELAY_MS"] ?? DEFAULT_SEND_DELAY_MS);
  return Number.isFinite(raw) && raw >= 1000 ? raw : DEFAULT_SEND_DELAY_MS;
}

function claimScanLimit(batchLimit: number) {
  const multiplier = Number(process.env["CAMPAIGN_WORKER_CLAIM_SCAN_MULTIPLIER"] ?? DEFAULT_CLAIM_SCAN_MULTIPLIER);
  const boundedMultiplier = Number.isFinite(multiplier) ? Math.max(1, Math.min(multiplier, 25)) : DEFAULT_CLAIM_SCAN_MULTIPLIER;
  return Math.max(batchLimit, Math.min(500, batchLimit * boundedMultiplier));
}

function fairCampaignBatch(jobs: JobRow[], batchLimit: number) {
  const perTenantLimit = Math.max(1, Math.ceil(batchLimit / 3));
  const tenantCounts = new Map<string, number>();
  const selected: JobRow[] = [];
  for (const job of jobs) {
    const count = tenantCounts.get(job.tenant_id) ?? 0;
    if (count >= perTenantLimit) continue;
    selected.push(job);
    tenantCounts.set(job.tenant_id, count + 1);
    if (selected.length >= batchLimit) break;
  }
  if (selected.length >= batchLimit) return selected;
  const selectedIds = new Set(selected.map((job) => job.id));
  for (const job of jobs) {
    if (selectedIds.has(job.id)) continue;
    selected.push(job);
    if (selected.length >= batchLimit) break;
  }
  return selected;
}

function classifyCampaignError(error: string, jobType?: JobRow["job_type"]) {
  const rpc = classifyRpcError(error);
  if (rpc.scope === "RATE_LIMIT") return "FLOOD";
  if (rpc.scope === "AUTH" || rpc.sessionLevel) return "RESTRICTED";
  if (rpc.groupLevel && jobType === "GROUP") {
    if (rpc.code.includes("PRIVATE") || rpc.code.includes("FORBIDDEN") || rpc.code.includes("PEER_ID_INVALID")) {
      return "ENTITY_UNAVAILABLE";
    }
    return "NOT_WRITABLE";
  }
  const lower = error.toLowerCase();
  if (lower.includes("cooldown_until:") || lower.includes("cooling down")) return "COOLDOWN";
  if (
    lower.includes("flood") ||
    lower.includes("too many requests") ||
    lower.includes("retry after")
  ) {
    return "FLOOD";
  }
  if (
    lower.includes("not_writable") ||
    lower.includes("chat_write_forbidden") ||
    lower.includes("chat_send") ||
    lower.includes("chat_admin_required") ||
    lower.includes("user_banned_in_channel") ||
    lower.includes("not enough rights") ||
    lower.includes("write forbidden")
  ) {
    return "NOT_WRITABLE";
  }
  if (
    lower.includes("channel_private") ||
    lower.includes("username_not_occupied") ||
    lower.includes("chat not found") ||
    lower.includes("user not found") ||
    lower.includes("entity_unavailable")
  ) {
    return "ENTITY_UNAVAILABLE";
  }
  if (jobType === "GROUP" && (lower.includes("forbidden") || lower.includes("blocked"))) {
    return "NOT_WRITABLE";
  }
  if (jobType === "DM" && (lower.includes("forbidden") || lower.includes("blocked"))) {
    return "PERMANENT";
  }
  if (
    lower.includes("auth_key") ||
    lower.includes("session_revoked") ||
    lower.includes("session_expired") ||
    lower.includes("user_restricted")
  ) {
    return "RESTRICTED";
  }
  return "TEMPORARY";
}

function backoffMinutes(attempts: number) {
  return Math.min(60, 2 ** Math.max(attempts, 1));
}

function recoverableTelegramRetryAt(error: string, attempts: number) {
  const upper = error.toUpperCase();
  const explicitWait = upper.match(/(?:FLOOD_WAIT|SLOWMODE_WAIT|WAIT|RETRY_AFTER)[_: ]+(\d+)/)?.[1];
  const waitSeconds = explicitWait
    ? Number(explicitWait)
    : upper.includes("PEER_FLOOD")
      ? 60 * 60
      : backoffMinutes(attempts) * 60;
  const boundedSeconds = Number.isFinite(waitSeconds) ? Math.max(60, Math.min(waitSeconds, 24 * 60 * 60)) : 60 * 60;
  return new Date(Date.now() + boundedSeconds * 1000).toISOString();
}

async function campaignMessage(campaignId: string, tenantId: string) {
  const { data } = await db()
    .from("campaigns")
    .select("id, tenant_id, status, type, message, message_entities, connection_id, min_delay_seconds, max_delay_seconds, cycle_delay_minutes")
    .eq("id", campaignId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) throw new Error("Campaign not found.");
  if (data.status !== "RUNNING") throw new Error("Campaign is not running.");
  const campaign = data as {
    id: string;
    status: string;
    type: string;
    message: MessagePayload;
    message_entities?: unknown;
    connection_id: string | null;
    min_delay_seconds?: number | null;
    max_delay_seconds?: number | null;
    cycle_delay_minutes?: number | null;
  };
  campaign.message = {
    ...(campaign.message ?? {}),
    entities: normalizeMessageEntities(
      campaign.message?.entities?.length ? campaign.message.entities : campaign.message_entities,
      campaign.message?.text ?? "",
    ),
  };
  return campaign;
}

function parseDiagnosticTarget(type: DiagnosticTargetType, raw: string) {
  const value = raw.trim();
  if (!value) throw new Error(`${type} test target is not configured.`);
  const tme = value.match(/(?:https?:\/\/)?t\.me\/([A-Za-z0-9_]+)/i)?.[1];
  const username = tme ?? value.match(/^@?([A-Za-z][A-Za-z0-9_]{4,})$/)?.[1] ?? null;
  if (username) {
    return type === "GROUP"
      ? { username, telegramGroupId: null, accessHash: null, entityType: null }
      : { username, telegramUserId: null, accessHash: null };
  }
  if (/^-?\d+$/.test(value)) {
    const numeric = Number(value);
    if (!Number.isSafeInteger(numeric)) throw new Error(`${type} test target id is not a safe integer.`);
    return type === "GROUP"
      ? { username: null, telegramGroupId: Math.abs(numeric), accessHash: null, entityType: "CHAT" }
      : { username: null, telegramUserId: numeric, accessHash: null };
  }
  throw new Error(`${type} test target must be a Telegram username/link or numeric Telegram id.`);
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
    .select("id, status, restriction_status, cooldown_until, encrypted_session")
    .eq("id", connectionId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!data) throw new Error("Sending session not found.");
  if (!data.encrypted_session) throw new Error("Sending session is not authorized.");
  if (["DISCONNECTED", "AUTH_CODE_SENT", "TWO_FACTOR_REQUIRED"].includes(String(data.status))) {
    throw new Error("Sending session is not connected.");
  }
  if (data.cooldown_until && new Date(data.cooldown_until as string) > new Date()) {
    throw new Error(`COOLDOWN_UNTIL:${data.cooldown_until}`);
  }
}

async function resolveTarget(job: JobRow) {
  const client = db();
  if (job.job_type === "GROUP") {
    const { data } = await client
      .from("campaign_groups")
    .select("id, status, discovered_groups(id, title, username, telegram_group_id, access_hash, entity_type, status, can_send_messages, writable_status, sendable_status)")
      .eq("id", job.target_id)
      .eq("tenant_id", job.tenant_id)
      .maybeSingle();
    const group = Array.isArray(data?.discovered_groups)
      ? data?.discovered_groups[0]
      : data?.discovered_groups;
    if (!data || !group) throw new Error("Group target not found.");
    if (!["APPROVED", "JOINED"].includes(String(group.status)))
      throw new Error("Group is not approved.");
    if (group.writable_status === "INACCESSIBLE" && group.sendable_status !== "SENDABLE") {
      throw new Error("ENTITY_UNAVAILABLE: group is inaccessible.");
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
  const [{ data: campaign }, sent, failed, remaining] = await Promise.all([
    client
      .from("campaigns")
      .select("id, type, status, cycle_delay_minutes, cycles_completed, completed_count, failed_count")
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
  const currentSent = sent.count ?? 0;
  const currentFailed = failed.count ?? 0;
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if ((remaining.count ?? 0) === 0 && campaign?.type === "GROUP" && campaign?.status === "RUNNING") {
    const nextCompleted = Number(campaign.completed_count ?? 0) + currentSent;
    const nextFailed = Number(campaign.failed_count ?? 0) + currentFailed;
    const nextRun = new Date(
      Date.now() + Math.max(1, Number(campaign.cycle_delay_minutes ?? 20)) * 60_000,
    ).toISOString();
    update["completed_count"] = nextCompleted;
    update["failed_count"] = nextFailed;
    update["cycles_completed"] = Number(campaign.cycles_completed ?? 0) + 1;
    update["last_run_at"] = new Date().toISOString();
    update["next_run_at"] = nextRun;
    if (currentSent > 0) {
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
        .eq("job_type", "GROUP")
        .eq("status", "SENT");
    } else {
      update["status"] = nextFailed > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
      update["completed_at"] = new Date().toISOString();
    }
  } else if ((remaining.count ?? 0) === 0) {
    update["completed_count"] = currentSent;
    update["failed_count"] = currentFailed;
    update["status"] = currentFailed > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
    update["completed_at"] = new Date().toISOString();
  } else if (campaign?.type !== "GROUP") {
    update["completed_count"] = currentSent;
    update["failed_count"] = currentFailed;
  }
  await client.from("campaigns").update(update).eq("id", campaignId).eq("tenant_id", tenantId);
}

async function recoverStaleCampaignAggregates(limit: number) {
  const { data: campaigns, error } = await db()
    .from("campaigns")
    .select("id, tenant_id")
    .eq("status", "RUNNING")
    .order("updated_at", { ascending: true, nullsFirst: false })
    .limit(Math.max(1, Math.min(limit, 50)));
  if (error) throw new Error(error.message);
  let recovered = 0;
  for (const campaign of campaigns ?? []) {
    const { count: remaining } = await db()
      .from("campaign_jobs")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign.id)
      .in("status", ["QUEUED", "PROCESSING", "HELD", "PAUSED"]);
    if ((remaining ?? 0) > 0) continue;
    const { count: total } = await db()
      .from("campaign_jobs")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign.id);
    if ((total ?? 0) === 0) continue;
    await markCampaignCounts(String(campaign.id), String(campaign.tenant_id));
    recovered += 1;
  }
  return recovered;
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

async function campaignFailureContext(job: JobRow) {
  const client = db();
  const { data: connection } = job.connection_id
    ? await client
        .from("telegram_connections")
        .select("id, label, account_name, username, telegram_user_id")
        .eq("id", job.connection_id)
        .eq("tenant_id", job.tenant_id)
        .maybeSingle()
    : { data: null };
  if (job.job_type === "GROUP") {
    const { data } = await client
      .from("campaign_groups")
      .select("id, discovered_groups(title, username, status, writable_status, sendable_status)")
      .eq("id", job.target_id)
      .eq("tenant_id", job.tenant_id)
      .maybeSingle();
    const group = Array.isArray(data?.discovered_groups)
      ? data?.discovered_groups[0]
      : data?.discovered_groups;
    return {
      group_title: group?.title ?? null,
      group_username: group?.username ?? null,
      group_status: group?.status ?? null,
      writable_status: group?.writable_status ?? null,
      sendable_status: group?.sendable_status ?? null,
      session_label: connection?.label ?? null,
      session_account_name: connection?.account_name ?? null,
      session_username: connection?.username ?? null,
      session_telegram_user_id: connection?.telegram_user_id ?? null,
    };
  }
  return {
    session_label: connection?.label ?? null,
    session_account_name: connection?.account_name ?? null,
    session_username: connection?.username ?? null,
    session_telegram_user_id: connection?.telegram_user_id ?? null,
  };
}

async function failJob(job: JobRow, error: string) {
  const rpc = classifyRpcError(error);
  const classification = classifyCampaignError(error, job.job_type);
  if (classification === "COOLDOWN") {
    const cooldown = error.match(/COOLDOWN_UNTIL:([^\s]+)/)?.[1];
    const runAfter =
      cooldown && !Number.isNaN(new Date(cooldown).getTime())
        ? new Date(cooldown).toISOString()
        : new Date(Date.now() + sendDelayMs()).toISOString();
    await db()
      .from("campaign_jobs")
      .update({
        status: "QUEUED",
        last_error: "Selected Telegram session is cooling down.",
        run_after: runAfter,
        locked_at: null,
        started_at: null,
      })
      .eq("id", job.id);
    await logCampaign(job, "INFO", "Job delayed for Telegram session cooldown.", {
      classification,
      run_after: runAfter,
    });
    await db()
      .from("campaigns")
      .update({ status: "RUNNING", next_run_at: runAfter, updated_at: new Date().toISOString() })
      .eq("id", job.campaign_id)
      .eq("tenant_id", job.tenant_id);
    console.info("CAMPAIGN_JOB_COOLDOWN", {
      tenantId: job.tenant_id,
      campaignId: job.campaign_id,
      jobId: job.id,
      runAfter,
    });
    return;
  }
  if (classification === "FLOOD") {
    const nextRun = recoverableTelegramRetryAt(error, job.attempts + 1);
    await db()
      .from("campaign_jobs")
      .update({
        status: "QUEUED",
        attempts: job.attempts + 1,
        last_error: error,
        run_after: nextRun,
        locked_at: null,
        started_at: null,
        completed_at: null,
      })
      .eq("id", job.id);
    if (job.connection_id) {
      await db()
        .from("telegram_connections")
        .update({ restriction_status: "COOLDOWN", cooldown_until: nextRun, error_message: error })
        .eq("id", job.connection_id)
        .eq("tenant_id", job.tenant_id);
    }
    await db()
      .from("campaigns")
      .update({ status: "RUNNING", next_run_at: nextRun, updated_at: new Date().toISOString() })
      .eq("id", job.campaign_id)
      .eq("tenant_id", job.tenant_id);
    const context = await campaignFailureContext(job);
    await logCampaign(job, "WARNING", rpc.human, {
      ...context,
      classification,
      telegram_scope: rpc.scope,
      telegram_code: rpc.code,
      raw_error: rpc.raw,
      human_reason: rpc.human,
      run_after: nextRun,
      test_type: "CAMPAIGN",
    });
    console.info("CAMPAIGN_JOB_COOLDOWN", {
      tenantId: job.tenant_id,
      campaignId: job.campaign_id,
      jobId: job.id,
      runAfter: nextRun,
      reason: rpc.code,
    });
    return;
  }
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
  const context = await campaignFailureContext(job);
  await logCampaign(job, final ? "ERROR" : "WARNING", rpc.human, {
    ...context,
    classification,
    telegram_scope: rpc.scope,
    telegram_code: rpc.code,
    raw_error: rpc.raw,
    human_reason: rpc.human,
    test_type: "CAMPAIGN",
  });
  if (classification === "ENTITY_UNAVAILABLE" || classification === "NOT_WRITABLE") {
    const targetTable = job.job_type === "GROUP" ? "campaign_groups" : "campaign_recipients";
    await db()
      .from(targetTable)
      .update({ status, error, sent_at: null })
      .eq("id", job.target_id)
      .eq("tenant_id", job.tenant_id);
    if (job.job_type === "GROUP" && classification === "NOT_WRITABLE") {
      const { data: target } = await db()
        .from("campaign_groups")
        .select("group_id")
        .eq("id", job.target_id)
        .eq("tenant_id", job.tenant_id)
        .maybeSingle();
      if (target?.group_id) {
        await db()
          .from("discovered_groups")
          .update({
            can_send_messages: false,
            writable_status: "NOT_WRITABLE",
            last_write_error: rpc.human,
            last_send_error: rpc.raw,
            updated_at: new Date().toISOString(),
          })
          .eq("id", target.group_id)
          .eq("tenant_id", job.tenant_id);
      }
    }
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
    console.info("CAMPAIGN_JOB_PICKED", {
      tenantId: job.tenant_id,
      campaignId: job.campaign_id,
      jobId: job.id,
      jobType: job.job_type,
    });
    const campaign = await campaignMessage(job.campaign_id, job.tenant_id);
    await verifyConnection(job.tenant_id, job.connection_id ?? campaign.connection_id);
    const target = await resolveTarget(job);
    await assertUsageQuota(
      job.tenant_id,
      "promotion_messages",
      "monthly_message_limit",
      1,
      "Monthly promotion message limit reached.",
    );
    if (target.kind === "DM") {
      await assertUsageQuota(
        job.tenant_id,
        "dm_messages",
        "monthly_dm_message_limit",
        1,
        "Monthly DM message limit reached.",
      );
    }
    console.info("TARGET_RESOLVE_OK", {
      tenantId: job.tenant_id,
      campaignId: job.campaign_id,
      jobId: job.id,
      jobType: job.job_type,
      targetKind: target.kind,
    });
    const connectionId = job.connection_id ?? campaign.connection_id ?? "";
    if (target.kind === "GROUP") {
      await sendGroupViaUserSession(job.tenant_id, connectionId, target.target, campaign.message);
    } else {
      await sendDirectViaUserSession(job.tenant_id, connectionId, target.target, campaign.message);
    }
    console.info("SEND_OK", {
      tenantId: job.tenant_id,
      campaignId: job.campaign_id,
      jobId: job.id,
      jobType: job.job_type,
    });

    await client
      .from("campaign_jobs")
      .update({ status: "SENT", completed_at: new Date().toISOString(), last_error: null })
      .eq("id", job.id);
    await client
      .from(target.targetTable)
      .update({ status: "SENT", sent_at: new Date().toISOString(), error: null })
      .eq("id", job.target_id);
    if (job.job_type === "GROUP") {
      const { data: sentTarget } = await client
        .from("campaign_groups")
        .select("group_id")
        .eq("id", job.target_id)
        .eq("tenant_id", job.tenant_id)
        .maybeSingle();
      if (sentTarget?.group_id) {
        await client
          .from("discovered_groups")
          .update({
            can_send_messages: true,
            writable_status: "WRITABLE",
            sendable_status: "SENDABLE",
            sendable_checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", sentTarget.group_id)
          .eq("tenant_id", job.tenant_id);
      }
    }
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
    await logCampaign(job, "INFO", "Message sent.", { target: target.label, compact_success: true });
    await incrementMonthlyUsage(job.tenant_id, {
      promotion_messages: 1,
      ...(target.kind === "DM" ? { dm_messages: 1 } : {}),
    });
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Campaign job failed.";
    console.warn("SEND_FAILED", {
      tenantId: job.tenant_id,
      campaignId: job.campaign_id,
      jobId: job.id,
      jobType: job.job_type,
      reason: message,
    });
    await failJob(job, message);
    return { failed: true, error: message };
  } finally {
    await markCampaignCounts(job.campaign_id, job.tenant_id);
  }
}

export async function processCampaignJobs(limit = DEFAULT_BATCH_LIMIT) {
  const batchLimit = Math.max(1, Math.min(limit, 50));
  await db()
    .from("campaign_jobs")
    .update({
      status: "QUEUED",
      locked_at: null,
      started_at: null,
      last_error: "Recovered stale processing job after worker restart.",
      run_after: new Date().toISOString(),
    })
    .eq("status", "PROCESSING")
    .lt("locked_at", new Date(Date.now() - 5 * 60_000).toISOString());
  const { data: candidates, error } = await db()
    .from("campaign_jobs")
    .select("*")
    .eq("status", "QUEUED")
    .lte("run_after", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(claimScanLimit(batchLimit));
  if (error) throw new Error(error.message);

  const jobs = fairCampaignBatch(((candidates ?? []) as unknown as JobRow[]), batchLimit);
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const job of jobs) {
    const result = await processJob(job);
    if (result.sent) sent += 1;
    else if (result.failed) failed += 1;
    else skipped += 1;
  }
  const recovered = await recoverStaleCampaignAggregates(batchLimit);
  await logSystem({
    action: "CAMPAIGN_WORKER_RUN",
    details: { requested: batchLimit, candidates: candidates?.length ?? 0, selected: jobs.length, sent, failed, skipped, recovered },
  });
  return { processed: jobs.length, sent, failed, skipped, recovered };
}

export async function sendDiagnosticCampaignMessage(input: {
  tenantId: string;
  connectionId: string;
  targetType: DiagnosticTargetType;
  target: string;
  message: MessagePayload;
  senderPremium: boolean | null;
}) {
  const normalizedMessage = {
    ...input.message,
    entities: normalizeMessageEntities(input.message.entities ?? [], input.message.text ?? ""),
  };
  const { data: campaign, error } = await db()
    .from("campaigns")
    .insert({
      tenant_id: input.tenantId,
      name: `TEST MODE Telegram diagnostics ${input.targetType} ${new Date().toISOString()}`,
      type: input.targetType === "GROUP" ? "GROUP" : "DM",
      status: "RUNNING",
      connection_id: input.connectionId,
      message: normalizedMessage,
      message_entities: normalizedMessage.entities,
      total_targets: 1,
      started_at: new Date().toISOString(),
      min_delay_seconds: 1,
      max_delay_seconds: 1,
      cycle_delay_minutes: 20,
    })
    .select("id")
    .single();
  if (error || !campaign) throw new Error(error?.message ?? "Could not create diagnostic campaign record.");

  const job: JobRow = {
    id: `diagnostic-${input.targetType.toLowerCase()}`,
    tenant_id: input.tenantId,
    campaign_id: campaign.id as string,
    connection_id: input.connectionId,
    job_type: input.targetType,
    target_id: `diagnostic-${input.targetType.toLowerCase()}`,
    attempts: 0,
  };
  const timestamp = new Date().toISOString();
  try {
    const reloaded = await campaignMessage(campaign.id as string, input.tenantId);
    const diagnostics = entityDiagnostics(reloaded.message.entities ?? []);
    console.info("TELEGRAM_DIAGNOSTIC_ENTITY_RELOAD", {
      tenant_id: input.tenantId,
      campaign_id: campaign.id,
      target_type: input.targetType,
      entities: diagnostics,
    });
    await verifyConnection(input.tenantId, input.connectionId);
    const parsed = parseDiagnosticTarget(input.targetType, input.target);
    const sent = input.targetType === "GROUP"
      ? await sendGroupViaUserSession(input.tenantId, input.connectionId, parsed, reloaded.message)
      : await sendDirectViaUserSession(input.tenantId, input.connectionId, parsed, reloaded.message);
    await db()
      .from("campaigns")
      .update({
        status: "COMPLETED",
        completed_count: 1,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id)
      .eq("tenant_id", input.tenantId);
    await logCampaign(job, "INFO", "TEST MODE diagnostic message sent.", {
      target_type: input.targetType,
      message_id: sent.messageId,
      entity_types: diagnostics.map((entity) => entity.type),
      custom_emoji_document_id: diagnostics.find((entity) => entity.type === "custom_emoji")?.document_id ?? null,
      returned_entity_types: sent.entities.map((entity) => entity.type),
    });
    return {
      campaignId: campaign.id as string,
      targetType: input.targetType,
      messageId: sent.messageId,
      timestamp,
      senderSession: input.connectionId,
      senderPremium: input.senderPremium,
      entityTypesSent: diagnostics.map((entity) => entity.type),
      customEmojiDocumentId: diagnostics.find((entity) => entity.type === "custom_emoji")?.document_id ?? null,
      sentEntities: sent.entities,
    } satisfies DiagnosticCampaignSendResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telegram diagnostic send failed.";
    await db()
      .from("campaigns")
      .update({
        status: "COMPLETED_WITH_ERRORS",
        failed_count: 1,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id)
      .eq("tenant_id", input.tenantId);
    await logCampaign(job, "ERROR", "TEST MODE diagnostic message failed.", {
      target_type: input.targetType,
      error: message,
    });
    throw error;
  }
}
