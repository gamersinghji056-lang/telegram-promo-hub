/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "./db.server";
import type { AuthContext } from "./customer-auth.server";
import { discoverAdminDestinations } from "./growth-intelligence.server";
export type GrowthRange = "24H" | "7D" | "30D" | "90D";
function bounds(range: GrowthRange, customStart?: string | null, customEnd?: string | null) {
  const end = customEnd ? new Date(`${customEnd}T23:59:59.999Z`) : new Date(),
    hours = range === "24H" ? 24 : range === "7D" ? 168 : range === "90D" ? 2160 : 720,
    start = customStart
      ? new Date(`${customStart}T00:00:00.000Z`)
      : new Date(end.getTime() - hours * 3600_000),
    span = end.getTime() - start.getTime(),
    bucket =
      span <= 86400_000
        ? 3600
        : span <= 7 * 86400_000
          ? 21600
          : span <= 90 * 86400_000
            ? 86400
            : 604800;
  return { start: start.toISOString(), end: end.toISOString(), bucket };
}
export function transparentHealth(i: {
  netGrowth: number;
  joins: number;
  leaves: number;
  messages: number;
  reactions: number;
  members: number;
  snapshotCount: number;
}) {
  if (i.snapshotCount < 2 || i.joins + i.leaves + i.messages === 0) return null;
  const growth = Math.max(0, Math.min(30, 15 + i.netGrowth)),
    engagement = Math.max(
      0,
      Math.min(30, Math.round((i.members > 0 ? i.reactions / i.members : 0) * 300)),
    ),
    movement = i.joins + i.leaves,
    retention = movement
      ? Math.max(0, Math.min(20, Math.round(20 * (1 - i.leaves / movement))))
      : 20,
    activity = Math.max(0, Math.min(20, i.messages));
  return {
    score: growth + engagement + retention + activity,
    growth,
    engagement,
    retention,
    activity,
  };
}
export async function growthDashboard(
  ctx: AuthContext,
  input: {
    range?: GrowthRange;
    customStart?: string | null;
    customEnd?: string | null;
    destinationId?: string | null;
  } = {},
) {
  const client = db(),
    range = input.range ?? "30D",
    { start, end, bucket } = bounds(range, input.customStart, input.customEnd);
  let q = client
    .from("growth_destinations")
    .select(
      "id,connection_id,telegram_chat_id,title,username,destination_type,admin_status,capabilities,member_count,status,last_error_code,last_checked_at,last_collected_at",
    )
    .eq("tenant_id", ctx.tenantId)
    .order("member_count", { ascending: false });
  if (input.destinationId) q = q.eq("id", input.destinationId);
  const [
    { data: destinations },
    { data: aggregate, error },
    { data: connections },
    { data: checkpoints },
  ] = await Promise.all([
    q,
    client.rpc("growth_dashboard_range", {
      p_tenant_id: ctx.tenantId,
      p_start: start,
      p_end: end,
      p_bucket_seconds: bucket,
    }),
    client
      .from("telegram_connections")
      .select("id,label,username,telegram_user_id,status,health,telegram_premium")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at"),
    client
      .from("growth_collection_checkpoints")
      .select("destination_id,collection_type,checkpoint,last_success_at,last_error_code,flood_wait_until")
      .in("collection_type", ["ADMIN_LOG", "MEMBERSHIP_HISTORY"]),
  ]);
  if (error) throw new Error(error.message);
  const ids = (destinations ?? []).map((r) => r.id);
  const { data: events } = ids.length
    ? await client
        .from("growth_membership_events")
        .select(
          "id,destination_id,event_type,telegram_user_id,username,display_name,event_at,source_type,source_info,actor_user_id,previous_chat_status",
        )
        .eq("tenant_id", ctx.tenantId)
        .in("destination_id", ids)
        .gte("event_at", start)
        .lte("event_at", end)
        .order("event_at", { ascending: false })
        .range(0, 99)
    : { data: [] };
  const amap = new Map((aggregate ?? []).map((r: any) => [r.destination_id, r])),
    adminMap = new Map(
      (checkpoints ?? [])
        .filter((r: any) => r.collection_type === "ADMIN_LOG")
        .map((r: any) => [r.destination_id, r]),
    ),
    historyMap = new Map(
      (checkpoints ?? [])
        .filter((r: any) => r.collection_type === "MEMBERSHIP_HISTORY")
        .map((r: any) => [r.destination_id, r]),
    );
  const enriched = (destinations ?? []).map((d) => {
    const a: any = amap.get(d.id) ?? {},
      admin: any = adminMap.get(d.id),
      history: any = historyMap.get(d.id),
      joins = Number(a.joins ?? 0),
      leaves = Number(a.leaves ?? 0),
      messages = Number(a.messages ?? 0),
      reactions = a.reactions == null ? null : Number(a.reactions),
      views = a.views == null ? null : Number(a.views),
      forwards = a.forwards == null ? null : Number(a.forwards),
      netGrowth = joins - leaves,
      adminCheckpoint = admin?.checkpoint ?? {},
      historyCheckpoint = history?.checkpoint ?? {};
    return {
      ...d,
      joins,
      leaves,
      netGrowth,
      growthPercentage:
        a.starting_members && a.ending_members != null
          ? ((Number(a.ending_members) - Number(a.starting_members)) / Number(a.starting_members)) *
            100
          : null,
      messages,
      reactions,
      views,
      forwards,
      engagementRate: views && reactions != null ? (reactions / views) * 100 : null,
      startingMembers: a.starting_members,
      rangeEndingMembers: a.ending_members,
      snapshotCount: Number(a.snapshot_count ?? 0),
      chart: a.chart ?? [],
      health: transparentHealth({
        netGrowth,
        joins,
        leaves,
        messages,
        reactions: reactions ?? 0,
        members: Number(d.member_count ?? 0),
        snapshotCount: Number(a.snapshot_count ?? 0),
      }),
      coverage: {
        backfillComplete:
          Boolean(adminCheckpoint.backfillComplete) && Boolean(historyCheckpoint.backfillComplete),
        adminLog: {
          complete: Boolean(adminCheckpoint.backfillComplete),
          error: admin?.last_error_code,
        },
        membershipHistory: {
          complete: Boolean(historyCheckpoint.backfillComplete),
          started: Boolean(history),
          error: history?.last_error_code,
        },
        oldestEventAt: a.oldest_event_at,
        latestEventAt: a.latest_event_at,
        lastSync: history?.last_success_at ?? admin?.last_success_at,
        lastError: history?.last_error_code ?? admin?.last_error_code,
        floodWaitUntil: history?.flood_wait_until ?? admin?.flood_wait_until,
      },
    };
  });
  return {
    range,
    start,
    end,
    connections: connections ?? [],
    destinations: enriched,
    events: events ?? [],
    summary: {
      adminGroups: enriched.filter((r) => r.destination_type !== "CHANNEL").length,
      adminChannels: enriched.filter((r) => r.destination_type === "CHANNEL").length,
      totalMembers: enriched.reduce((s, r) => s + Number(r.member_count ?? 0), 0),
      joins: enriched.reduce((s, r) => s + r.joins, 0),
      leaves: enriched.reduce((s, r) => s + r.leaves, 0),
      netGrowth: enriched.reduce((s, r) => s + r.netGrowth, 0),
      engagement: enriched.reduce((s, r) => s + Number(r.reactions ?? 0), 0),
    },
    unavailable: ["Visitor data unavailable from Telegram"],
  };
}
export async function refreshGrowthDestinations(ctx: AuthContext, connectionId: string) {
  const { data: c } = await db()
    .from("telegram_connections")
    .select("id,status,health")
    .eq("id", connectionId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (!c) throw new Error("Telegram session not found.");
  if (c.status !== "CONNECTED" || c.health === "RECONNECT_REQUIRED")
    throw new Error("Reconnect required.");
  return discoverAdminDestinations(ctx.tenantId, ctx.customerId, connectionId);
}
export async function adminGrowthOverview() {
  const { data } = await db()
    .from("growth_destinations")
    .select(
      "id,tenant_id,customer_id,connection_id,title,username,destination_type,member_count,status,last_error_code,last_checked_at,last_collected_at,next_collect_at",
    )
    .order("last_checked_at", { ascending: false })
    .limit(500);
  return data ?? [];
}
