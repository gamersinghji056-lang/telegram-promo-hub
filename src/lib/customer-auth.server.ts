import { db, logSystem, getSetting } from "./db.server";
import {
  hashPassword,
  hashToken,
  newSessionToken,
  verifyPassword,
  verifyTelegramInitData,
} from "./security.server";
import { botToken } from "./telegram.server";

export type AuthContext = {
  customerId: string;
  tenantId: string;
  email: string;
  name: string | null;
  telegramUserId: number | null;
};

const SESSION_DAYS = 30;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export async function registrationSettings() {
  return getSetting<{
    registration_enabled?: boolean;
    email_verification_enabled?: boolean;
    default_plan_code?: string;
  }>("registration");
}

/** Creates a tenant + customer pair. Returns an error string on failure. */
export async function registerCustomer(input: {
  email: string;
  password: string;
  name?: string | null;
  telegramUserId?: number | null;
  telegramUsername?: string | null;
}): Promise<{ ok: true; customerId: string; tenantId: string } | { ok: false; error: string }> {
  const email = normalizeEmail(input.email);
  if (!validEmail(email)) return { ok: false, error: "Enter a valid email address." };
  if (!input.password || input.password.length < 8)
    return { ok: false, error: "Password must be at least 8 characters." };

  const settings = await registrationSettings();
  if (settings.registration_enabled === false)
    return { ok: false, error: "Registration is currently disabled by the platform administrator." };

  const client = db();
  const { data: existing } = await client.from("customers").select("id").eq("email", email).maybeSingle();
  if (existing) return { ok: false, error: "An account with this email already exists." };

  const { data: plan } = await client
    .from("plans")
    .select("id, duration_days")
    .eq("code", settings.default_plan_code ?? "FREE")
    .maybeSingle();

  const expires = plan
    ? new Date(Date.now() + (plan.duration_days as number) * 86400_000).toISOString()
    : null;

  const { data: tenant, error: tenantError } = await client
    .from("tenants")
    .insert({
      name: input.name?.trim() || email.split("@")[0],
      plan_id: plan?.id ?? null,
      plan_expires_at: expires,
    })
    .select("id")
    .single();
  if (tenantError || !tenant) return { ok: false, error: "Could not create the workspace." };

  const { data: customer, error: customerError } = await client
    .from("customers")
    .insert({
      tenant_id: tenant.id,
      email,
      password_hash: await hashPassword(input.password),
      name: input.name?.trim() || null,
      telegram_user_id: input.telegramUserId ?? null,
      telegram_username: input.telegramUsername ?? null,
      email_verified: !settings.email_verification_enabled,
    })
    .select("id")
    .single();

  if (customerError || !customer) {
    await client.from("tenants").delete().eq("id", tenant.id);
    return { ok: false, error: "Could not create the account. This Telegram account may already be linked." };
  }

  await client.from("tenant_members").insert({
    tenant_id: tenant.id,
    customer_id: customer.id,
    role: "customer",
  });

  if (plan) {
    await client.from("subscriptions").insert({
      tenant_id: tenant.id,
      plan_id: plan.id,
      status: "ACTIVE",
      payment_status: "NONE",
      expires_at: expires,
    });
  }

  await logSystem({
    tenant_id: tenant.id,
    customer_id: customer.id,
    action: "CUSTOMER_REGISTERED",
    resource: email,
  });
  return { ok: true, customerId: customer.id, tenantId: tenant.id };
}

export async function loginCustomer(input: {
  email: string;
  password: string;
  telegramUserId?: number | null;
  telegramUsername?: string | null;
}): Promise<{ ok: true; token: string; customerId: string } | { ok: false; error: string }> {
  const email = normalizeEmail(input.email);
  const client = db();
  const { data: customer } = await client
    .from("customers")
    .select("id, tenant_id, password_hash, status")
    .eq("email", email)
    .maybeSingle();

  if (!customer || !(await verifyPassword(input.password, customer.password_hash as string))) {
    await logSystem({ action: "LOGIN_FAILED", resource: email, status: "FAILED" });
    return { ok: false, error: "Invalid email or password." };
  }
  if (customer.status !== "ACTIVE")
    return { ok: false, error: "This account is suspended. Contact support." };

  const token = newSessionToken();
  await client.from("customer_sessions").insert({
    customer_id: customer.id,
    tenant_id: customer.tenant_id,
    token_hash: hashToken(token),
    expires_at: new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString(),
  });

  const patch: Record<string, unknown> = { last_login_at: new Date().toISOString() };
  if (input.telegramUserId) {
    patch["telegram_user_id"] = input.telegramUserId;
    patch["telegram_username"] = input.telegramUsername ?? null;
  }
  await client.from("customers").update(patch).eq("id", customer.id);

  await logSystem({
    tenant_id: customer.tenant_id as string,
    customer_id: customer.id as string,
    action: "LOGIN",
    resource: email,
  });
  return { ok: true, token, customerId: customer.id as string };
}

/**
 * Resolves the authenticated customer. Never trusts a tenant/customer id from the client.
 * `auth` is either `tma <telegram initData>` or `sess <session token>`.
 */
export async function resolveAuth(auth: string | undefined | null): Promise<AuthContext> {
  if (!auth) throw new Error("UNAUTHENTICATED");
  const client = db();

  if (auth.startsWith("tma ")) {
    const token = botToken();
    if (!token) throw new Error("BOT_NOT_CONFIGURED");
    const tgUser = verifyTelegramInitData(auth.slice(4), token);
    if (!tgUser) throw new Error("UNAUTHENTICATED");
    const { data } = await client
      .from("customers")
      .select("id, tenant_id, email, name, telegram_user_id, status")
      .eq("telegram_user_id", tgUser.id)
      .maybeSingle();
    if (!data) throw new Error("NO_ACCOUNT");
    if (data.status !== "ACTIVE") throw new Error("SUSPENDED");
    return {
      customerId: data.id as string,
      tenantId: data.tenant_id as string,
      email: data.email as string,
      name: (data.name as string) ?? null,
      telegramUserId: (data.telegram_user_id as number) ?? null,
    };
  }

  if (auth.startsWith("sess ")) {
    const { data } = await client
      .from("customer_sessions")
      .select("customer_id, tenant_id, expires_at")
      .eq("token_hash", hashToken(auth.slice(5)))
      .maybeSingle();
    if (!data || new Date(data.expires_at as string) < new Date()) throw new Error("UNAUTHENTICATED");
    const { data: customer } = await client
      .from("customers")
      .select("id, tenant_id, email, name, telegram_user_id, status")
      .eq("id", data.customer_id)
      .maybeSingle();
    if (!customer) throw new Error("UNAUTHENTICATED");
    if (customer.status !== "ACTIVE") throw new Error("SUSPENDED");
    return {
      customerId: customer.id as string,
      tenantId: customer.tenant_id as string,
      email: customer.email as string,
      name: (customer.name as string) ?? null,
      telegramUserId: (customer.telegram_user_id as number) ?? null,
    };
  }

  throw new Error("UNAUTHENTICATED");
}
