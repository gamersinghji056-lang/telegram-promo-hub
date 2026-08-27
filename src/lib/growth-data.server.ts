import { db } from "./db.server";
import type { AuthContext } from "./customer-auth.server";
import { discoverAdminDestinations } from "./growth-intelligence.server";

function rangeStart(range: "24H" | "7D" | "30D", customStart?: string | null) {
  if (customStart) return new Date(customStart).toISOString();
  const hours = range === "24H" ? 24 : range === "7D" ? 168 : 720;
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

export function transparentHealth(input: { netGrowth: number; joins: number; leaves: number; messages: number; reactions: number; members: number; snapshotCount: number }) {
  if (input.snapshotCount < 2) return null;
  const growth = Math.max(0, Math.min(30, 15 + input.netGrowth));
  const engagementRate = input.members > 0 ? input.reactions / input.members : 0;
  const engagement = Math.max(0, Math.min(30, Math.round(engagementRate * 300)));
  const totalMovement = input.joins + input.leaves;
  const retention = totalMovement ? Math.max(0, Math.min(20, Math.round(20 * (1 - input.leaves / totalMovement)))) : 20;
  const activity = Math.max(0, Math.min(20, input.messages));
  return { score: growth + engagement + retention + activity, growth, engagement, retention, activity };
}

export async function growthDashboard(ctx: AuthContext, input: { range?: "24H" | "7D" | "30D"; customStart?: string | null; customEnd?: string | null; destinationId?: string | null } = {}) {
  const client = db();
  const start = rangeStart(input.range ?? "7D", input.customStart);
  const end = input.customEnd ? new Date(input.customEnd).toISOString() : new Date().toISOString();
  let destinationQuery = client.from("growth_destinations").select("id,connection_id,telegram_chat_id,title,username,destination_type,admin_status,capabilities,member_count,status,last_error_code,last_checked_at,last_collected_at").eq("tenant_id", ctx.tenantId).order("member_count", { ascending: false });
  if (input.destinationId) destinationQuery = destinationQuery.eq("id", input.destinationId);
  const { data: destinations } = await destinationQuery;
  const ids = (destinations ?? []).map((row) => row.id);
  const [{ data: snapshots }, { data: events }, { data: content }, { data: connections }] = await Promise.all([
    ids.length ? client.from("growth_snapshots").select("*").eq("tenant_id", ctx.tenantId).in("destination_id", ids).gte("snapshot_bucket", start).lte("snapshot_bucket", end).order("snapshot_bucket") : Promise.resolve({ data: [] }),
    ids.length ? client.from("growth_membership_events").select("*").eq("tenant_id", ctx.tenantId).in("destination_id", ids).gte("event_at", start).lte("event_at", end).order("event_at", { ascending: false }).limit(500) : Promise.resolve({ data: [] }),
    ids.length ? client.from("growth_content_metrics").select("*").eq("tenant_id", ctx.tenantId).in("destination_id", ids).gte("posted_at", start).lte("posted_at", end).order("posted_at", { ascending: false }).limit(500) : Promise.resolve({ data: [] }),
    client.from("telegram_connections").select("id,label,username,telegram_user_id,status,health,telegram_premium").eq("tenant_id", ctx.tenantId).order("created_at"),
  ]);
  const enriched = (destinations ?? []).map((destination) => {
    const ownSnapshots = (snapshots ?? []).filter((row) => row.destination_id === destination.id);
    const ownEvents = (events ?? []).filter((row) => row.destination_id === destination.id);
    const ownContent = (content ?? []).filter((row) => row.destination_id === destination.id);
    const joins = ownEvents.filter((row) => row.event_type === "JOINED").length;
    const leaves = ownEvents.filter((row) => row.event_type === "LEFT").length;
    const messages = ownContent.length;
    const reactions = ownContent.reduce((sum, row) => sum + Number(row.reactions ?? 0), 0);
    const views = ownContent.reduce((sum, row) => sum + Number(row.views ?? 0), 0);
    const netGrowth = joins - leaves;
    return { ...destination, joins, leaves, netGrowth, growthPercentage: Number(destination.member_count) > 0 ? (netGrowth / Number(destination.member_count)) * 100 : null, messages, reactions, views, forwards: ownContent.reduce((sum, row) => sum + Number(row.forwards ?? 0), 0), engagementRate: views > 0 ? (reactions / views) * 100 : null, health: transparentHealth({ netGrowth, joins, leaves, messages, reactions, members: Number(destination.member_count ?? 0), snapshotCount: ownSnapshots.length }), snapshots: ownSnapshots };
  });
  return {
    range: input.range ?? "7D", start, end, connections: connections ?? [], destinations: enriched, events: events ?? [], content: content ?? [],
    summary: { adminGroups: enriched.filter((row) => row.destination_type !== "CHANNEL").length, adminChannels: enriched.filter((row) => row.destination_type === "CHANNEL").length, totalMembers: enriched.reduce((sum, row) => sum + Number(row.member_count ?? 0), 0), joins: enriched.reduce((sum, row) => sum + row.joins, 0), leaves: enriched.reduce((sum, row) => sum + row.leaves, 0), netGrowth: enriched.reduce((sum, row) => sum + row.netGrowth, 0), engagement: enriched.reduce((sum, row) => sum + row.reactions, 0) },
    unavailable: ["Visitor data unavailable from Telegram"],
  };
}

export async function refreshGrowthDestinations(ctx: AuthContext, connectionId: string) {
  const { data: connection } = await db().from("telegram_connections").select("id,status,health").eq("id", connectionId).eq("tenant_id", ctx.tenantId).maybeSingle();
  if (!connection) throw new Error("Telegram session not found.");
  if (connection.status !== "CONNECTED" || connection.health === "RECONNECT_REQUIRED") throw new Error("Reconnect required.");
  return discoverAdminDestinations(ctx.tenantId, ctx.customerId, connectionId);
}

export async function adminGrowthOverview() {
  const { data } = await db().from("growth_destinations").select("id,tenant_id,customer_id,connection_id,title,username,destination_type,member_count,status,last_error_code,last_checked_at,last_collected_at,next_collect_at").order("last_checked_at", { ascending: false }).limit(500);
  return data ?? [];
}
