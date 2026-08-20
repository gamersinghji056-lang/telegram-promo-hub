import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Service-role client. Server-only. All tenant scoping is enforced in code below. */
export function db(): SupabaseClient {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_SERVICE_ROLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type SettingsKey = "general" | "registration" | "payments" | "telegram" | "discovery" | "addons";

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
  await db()
    .from("notifications")
    .insert({ tenant_id: tenantId, title, body: body ?? null, kind, link: link ?? null });
}
