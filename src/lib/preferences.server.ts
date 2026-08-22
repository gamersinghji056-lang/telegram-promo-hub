import { db } from "./db.server";
import type { AuthContext } from "./customer-auth.server";
import { directionForLanguage, normalizeLanguage, type ThemeMode } from "./i18n";

type PreferenceNotifications = Record<string, string | number | boolean | null>;

function normalizeTheme(value?: string | null): ThemeMode {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export async function customerPreferences(ctx: AuthContext) {
  const { data } = await db()
    .from("customer_preferences")
    .select("*")
    .eq("customer_id", ctx.customerId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  const language = normalizeLanguage(data?.language);
  const theme = normalizeTheme(data?.theme);
  return { language, theme, direction: directionForLanguage(language), notifications: data?.notifications ?? {} };
}

export async function saveCustomerPreferences(ctx: AuthContext, input: { language?: string; theme?: string; notifications?: PreferenceNotifications }) {
  const { data: current } = await db()
    .from("customer_preferences")
    .select("*")
    .eq("customer_id", ctx.customerId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  const language = input.language === undefined ? normalizeLanguage(current?.language) : normalizeLanguage(input.language);
  const theme = input.theme === undefined ? normalizeTheme(current?.theme) : normalizeTheme(input.theme);
  const notifications = input.notifications === undefined ? ((current?.notifications ?? {}) as PreferenceNotifications) : input.notifications;
  await db().from("customer_preferences").upsert(
    {
      customer_id: ctx.customerId,
      tenant_id: ctx.tenantId,
      language,
      theme,
      notifications,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "customer_id" },
  );
  return { language, theme, direction: directionForLanguage(language), notifications };
}

export async function adminPreferences(adminUserId: string) {
  const { data } = await db()
    .from("admin_preferences")
    .select("*")
    .eq("admin_user_id", adminUserId)
    .maybeSingle();
  const language = normalizeLanguage(data?.language);
  const theme = normalizeTheme(data?.theme);
  return { language, theme, direction: directionForLanguage(language) };
}

export async function saveAdminPreferences(adminUserId: string, input: { language?: string; theme?: string }) {
  const { data: current } = await db()
    .from("admin_preferences")
    .select("*")
    .eq("admin_user_id", adminUserId)
    .maybeSingle();
  const language = input.language === undefined ? normalizeLanguage(current?.language) : normalizeLanguage(input.language);
  const theme = input.theme === undefined ? normalizeTheme(current?.theme) : normalizeTheme(input.theme);
  await db().from("admin_preferences").upsert(
    { admin_user_id: adminUserId, language, theme, updated_at: new Date().toISOString() },
    { onConflict: "admin_user_id" },
  );
  return { language, theme, direction: directionForLanguage(language) };
}
