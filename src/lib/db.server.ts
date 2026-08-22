import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Service-role client. Server-only. All tenant scoping is enforced in code below. */
export function db(): SupabaseClient {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type SettingsKey = "general" | "registration" | "payments" | "telegram" | "discovery" | "addons" | "notifications";

export async function getSetting<T = Record<string, unknown>>(key: SettingsKey): Promise<T> {
  const { data } = await db().from("system_settings").select("value").eq("key", key).maybeSingle();
  return ((data?.value ?? {}) as T);
}

export async function setSetting(key: SettingsKey, value: Record<string, unknown>) {
  await db()
    .from("system_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

export async function logSystem(entry: {
  tenant_id?: string | null;
  customer_id?: string | null;
  action: string;
  resource?: string | null;
  status?: string;
  details?: Record<string, unknown>;
}) {
  await db().from("system_logs").insert({
    tenant_id: entry.tenant_id ?? null,
    customer_id: entry.customer_id ?? null,
    action: entry.action,
    resource: entry.resource ?? null,
    status: entry.status ?? "OK",
    details: entry.details ?? {},
  });
}

export async function logAdmin(entry: {
  admin_user_id?: string | null;
  action: string;
  resource?: string | null;
  details?: Record<string, unknown>;
}) {
  await db().from("admin_logs").insert({
    admin_user_id: entry.admin_user_id ?? null,
    action: entry.action,
    resource: entry.resource ?? null,
    details: entry.details ?? {},
  });
}

export async function notify(
  tenantId: string,
  title: string,
  body?: string,
  kind = "INFO",
  link?: string | null,
) {
  const settings = await getSetting<{
    payment_confirmation_notifications?: boolean;
    plan_expiry_notifications?: boolean;
    quota_warning_notifications?: boolean;
    platform_announcements_enabled?: boolean;
  }>("notifications");
  const text = `${title} ${body ?? ""}`.toLowerCase();
  if (text.includes("payment") && settings.payment_confirmation_notifications === false) return;
  if ((text.includes("expiry") || text.includes("expir")) && settings.plan_expiry_notifications === false) return;
  if ((text.includes("quota") || text.includes("limit")) && settings.quota_warning_notifications === false) return;
  if (kind === "ANNOUNCEMENT" && settings.platform_announcements_enabled === false) return;
  await db()
    .from("notifications")
    .insert({ tenant_id: tenantId, title, body: body ?? null, kind, link: link ?? null });
}
