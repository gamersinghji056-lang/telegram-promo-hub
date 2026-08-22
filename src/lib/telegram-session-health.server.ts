import { db } from "./db.server";

export type SessionHealthEvidence =
  | "AUTH_OK"
  | "RESOLVE_OK"
  | "SEND_OK"
  | "DELETE_OK"
  | "SESSION_FAILURE"
  | "AUTH_FAILURE"
  | "RATE_LIMIT"
  | "GROUP_FAILURE"
  | "TRANSIENT";

const SCORE_DELTA: Record<SessionHealthEvidence, number> = {
  AUTH_OK: 4,
  RESOLVE_OK: 2,
  SEND_OK: 3,
  DELETE_OK: 1,
  SESSION_FAILURE: -8,
  AUTH_FAILURE: -35,
  RATE_LIMIT: -10,
  GROUP_FAILURE: 0,
  TRANSIENT: -1,
};

const SUMMARY: Record<SessionHealthEvidence, string> = {
  AUTH_OK: "Healthy - authorization valid",
  RESOLVE_OK: "Healthy - group resolution successful",
  SEND_OK: "Healthy - recent sends successful",
  DELETE_OK: "Healthy - test cleanup successful",
  SESSION_FAILURE: "Session-specific failures detected",
  AUTH_FAILURE: "Session authorization needs attention",
  RATE_LIMIT: "Telegram rate limit or cooldown active",
  GROUP_FAILURE: "Group-level restriction detected",
  TRANSIENT: "Transient Telegram/API issue detected",
};

export function sessionUsable(row: Record<string, unknown>) {
  const cooldown = row.cooldown_until ? new Date(String(row.cooldown_until)).getTime() : 0;
  const status = String(row.status ?? "");
  const restriction = String(row.restriction_status ?? "NONE");
  const health = String(row.health ?? "");
  const errorCode = String(row.session_error_code ?? "");
  return Boolean(row.encrypted_session) &&
    !["DISCONNECTED", "AUTH_CODE_SENT", "TWO_FACTOR_REQUIRED", "ERROR"].includes(status) &&
    !["RECONNECT_REQUIRED", "INVALID_AUTH", "REQUIRES_ACTION"].includes(health) &&
    errorCode !== "AUTH_KEY_UNREGISTERED" &&
    restriction !== "REQUIRES_ACTION" &&
    (!cooldown || cooldown <= Date.now());
}

export async function eligibleTenantSessions(tenantId: string) {
  const { data } = await db()
    .from("telegram_connections")
    .select("*")
    .eq("tenant_id", tenantId)
    .not("encrypted_session", "is", null)
    .order("health_score", { ascending: false, nullsFirst: false })
    .order("last_used_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });
  return (data ?? []).filter((row) => sessionUsable(row as Record<string, unknown>));
}

export async function bestTenantSession(tenantId: string) {
  const rows = await eligibleTenantSessions(tenantId);
  if (!rows.length) throw new Error("Connect a usable Telegram session first.");
  return rows[0];
}

export async function recordSessionHealthEvidence(input: {
  tenantId: string;
  connectionId?: string | null;
  evidence: SessionHealthEvidence;
  reason?: string | null;
  details?: Record<string, unknown>;
}) {
  if (!input.connectionId) return;
  const delta = SCORE_DELTA[input.evidence] ?? 0;
  const client = db();
  const { data: current } = await client
    .from("telegram_connections")
    .select("health_score")
    .eq("tenant_id", input.tenantId)
    .eq("id", input.connectionId)
    .maybeSingle();
  const score = Math.max(0, Math.min(100, Number(current?.health_score ?? 75) + delta));
  await client
    .from("telegram_connections")
    .update({
      health_score: score,
      health_updated_at: new Date().toISOString(),
      health_summary: input.reason || SUMMARY[input.evidence],
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.connectionId);
  await client.from("session_health_events").insert({
    tenant_id: input.tenantId,
    connection_id: input.connectionId,
    evidence_type: input.evidence,
    score_delta: delta,
    reason: input.reason ?? SUMMARY[input.evidence],
    details: input.details ?? {},
  });
}
