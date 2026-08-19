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
const FLOW_TTL_MINUTES = 20;

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
    default_duration_days?: number;
    new_user_status?: "ACTIVE" | "PENDING_APPROVAL";
    welcome_message?: string;
  }>("registration");
}

async function createCustomerSession(input: {
  customerId: string;
  tenantId: string;
}): Promise<string> {
  const token = newSessionToken();

  await db()
    .from("customer_sessions")
    .insert({
      customer_id: input.customerId,
      tenant_id: input.tenantId,
      token_hash: hashToken(token),
      expires_at: new Date(
        Date.now() + SESSION_DAYS * 86400_000,
      ).toISOString(),
    });

  return token;
}

export async function createCustomerSessionForCustomer(input: {
  customerId: string;
  tenantId: string;
}) {
  return createCustomerSession(input);
}

export function flowExpiresAt() {
  return new Date(
    Date.now() + FLOW_TTL_MINUTES * 60_000,
  ).toISOString();
}

export async function clearTelegramFlow(
  telegramUserId: number,
) {
  await db()
    .from("bot_states")
    .delete()
    .eq("telegram_user_id", telegramUserId);
}

export async function createTelegramFlow(input: {
  telegramUserId: number;
  flow: "REGISTRATION" | "LOGIN";
  step: string;
  payload?: Record<string, unknown>;
}): Promise<string> {
  const token = newSessionToken();

  await db()
    .from("bot_states")
    .upsert(
      {
        telegram_user_id: input.telegramUserId,
        flow: input.flow,
        step: input.step,
        state: `${input.flow}:${input.step}`,
        payload: input.payload ?? {},
        flow_token_hash: hashToken(token),
        created_at: new Date().toISOString(),
        expires_at: flowExpiresAt(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "telegram_user_id" },
    );

  return token;
}

async function consumeTelegramFlow(
  token: string,
  expectedFlow: "REGISTRATION" | "LOGIN",
): Promise<{
  telegramUserId: number;
  payload: Record<string, unknown>;
}> {
  if (!token) {
    throw new Error(
      "This registration link is invalid. Return to the bot and start again.",
    );
  }

  const client = db();

  const { data } = await client
    .from("bot_states")
    .select(
      "telegram_user_id, flow, payload, expires_at",
    )
    .eq("flow_token_hash", hashToken(token))
    .maybeSingle();

  if (!data || data.flow !== expectedFlow) {
    throw new Error(
      "This secure link is invalid. Return to the bot and start again.",
    );
  }

  if (new Date(data.expires_at as string) < new Date()) {
    await clearTelegramFlow(
      data.telegram_user_id as number,
    );

    throw new Error(
      "This secure link expired. Return to the bot and start again.",
    );
  }

  return {
    telegramUserId: data.telegram_user_id as number,
    payload:
      (data.payload as Record<string, unknown>) ?? {},
  };
}

/**
 * Creates a tenant + customer pair.
 * Returns an error string on failure.
 */
export async function registerCustomer(input: {
  email: string;
  password: string;
  name?: string | null;
  telegramUserId?: number | null;
  telegramUsername?: string | null;
}): Promise<
  | {
      ok: true;
      customerId: string;
      tenantId: string;
      status: string;
    }
  | {
      ok: false;
      error: string;
    }
> {
  if (!input.password || input.password.length < 8) {
    return {
      ok: false,
      error:
        "Password must be at least 8 characters.",
    };
  }

  return registerCustomerWithPasswordHash({
    email: input.email,
    passwordHash: await hashPassword(
      input.password,
    ),
    name: input.name,
    telegramUserId: input.telegramUserId,
    telegramUsername: input.telegramUsername,
  });
}

export async function registerCustomerWithPasswordHash(
  input: {
    email: string;
    passwordHash: string;
    name?: string | null;
    telegramUserId?: number | null;
    telegramUsername?: string | null;
  },
): Promise<
  | {
      ok: true;
      customerId: string;
      tenantId: string;
      status: string;
    }
  | {
      ok: false;
      error: string;
    }
> {
  const email = normalizeEmail(input.email);

  if (!validEmail(email)) {
    return {
      ok: false,
      error: "Enter a valid email address.",
    };
  }

  if (!input.passwordHash) {
    return {
      ok: false,
      error:
        "Password could not be processed.",
    };
  }

  const settings = await registrationSettings();

  if (settings.registration_enabled === false) {
    return {
      ok: false,
      error:
        "Registration is currently disabled by the platform administrator.",
    };
  }

  const client = db();

  const { data: existing } = await client
    .from("customers")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    return {
      ok: false,
      error:
        "An account with this email already exists.",
    };
  }

  const { data: plan } = await client
    .from("plans")
    .select("id, duration_days")
    .eq(
      "code",
      settings.default_plan_code ?? "TEST",
    )
    .maybeSingle();

  const durationDays = Number(settings.default_duration_days ?? plan?.duration_days ?? 30);
  const expires = plan
    ? new Date(
        Date.now() +
          durationDays *
            86400_000,
      ).toISOString()
    : null;
  const newStatus = settings.new_user_status === "PENDING_APPROVAL" ? "PENDING_APPROVAL" : "ACTIVE";
  const requestedName = input.name?.trim() || null;
  const { data: generatedName } = requestedName
    ? { data: requestedName }
    : await client.rpc("next_customer_profile_name");
  const profileName = String(generatedName || requestedName || "User001");

  const { data: tenant, error: tenantError } = await client
    .from("tenants")
    .insert({
      name: profileName,
      plan_id: plan?.id ?? null,
      plan_expires_at: expires,
      status: newStatus === "ACTIVE" ? "ACTIVE" : "SUSPENDED",
    })
    .select("id")
    .single();

  if (tenantError || !tenant) {
    return {
      ok: false,
      error:
        "Could not create the workspace.",
    };
  }

  const {
    data: customer,
    error: customerError,
  } = await client
    .from("customers")
    .insert({
      tenant_id: tenant.id,
      email,
      password_hash: input.passwordHash,
      name: profileName,
      telegram_user_id: input.telegramUserId ?? null,
      telegram_username: input.telegramUsername ?? null,
      email_verified: !settings.email_verification_enabled,
      status: newStatus,
    })
    .select("id")
    .single();

  if (customerError || !customer) {
    await client
      .from("tenants")
      .delete()
      .eq("id", tenant.id);

    return {
      ok: false,
      error:
        "Could not create the account. This Telegram account may already be linked.",
    };
  }

  await client
    .from("tenant_members")
    .insert({
      tenant_id: tenant.id,
      customer_id: customer.id,
      role: "customer",
    });

  if (plan) {
    await client
      .from("subscriptions")
      .insert({
        tenant_id: tenant.id,
        plan_id: plan.id,
        status: "ACTIVE",
        payment_status: "NONE",
        expires_at: expires,
      });
  }

  if (settings.welcome_message) {
    await client.from("notifications").insert({
      tenant_id: tenant.id,
      title: "Welcome",
      body: settings.welcome_message,
      kind: "INFO",
      link: "/mini-app/dashboard",
    });
  }

  await logSystem({
    tenant_id: tenant.id,
    customer_id: customer.id,
    action: "CUSTOMER_REGISTERED",
    resource: email,
  });

  return {
    ok: true,
    customerId: customer.id,
    tenantId: tenant.id,
    status: newStatus,
  };
}

export async function loginCustomer(input: {
  email: string;
  password: string;
  telegramUserId?: number | null;
  telegramUsername?: string | null;
}): Promise<
  | {
      ok: true;
      token: string;
      customerId: string;
    }
  | {
      ok: false;
      error: string;
    }
> {
  const email = normalizeEmail(input.email);
  const client = db();

  const { data: customer } = await client
    .from("customers")
    .select(
      "id, tenant_id, password_hash, status",
    )
    .eq("email", email)
    .maybeSingle();

  if (
    !customer ||
    !(await verifyPassword(
      input.password,
      customer.password_hash as string,
    ))
  ) {
    await logSystem({
      action: "LOGIN_FAILED",
      resource: email,
      status: "FAILED",
    });

    return {
      ok: false,
      error: "Invalid email or password.",
    };
  }

  if (customer.status !== "ACTIVE") {
    return {
      ok: false,
      error:
        "This account is suspended. Contact support.",
    };
  }

  const patch: Record<string, unknown> = {
    last_login_at: new Date().toISOString(),
  };

  if (input.telegramUserId) {
    await client
      .from("customers")
      .update({
        telegram_user_id: null,
        telegram_username: null,
      })
      .eq(
        "telegram_user_id",
        input.telegramUserId,
      )
      .neq("id", customer.id);

    patch["telegram_user_id"] =
      input.telegramUserId;

    patch["telegram_username"] =
      input.telegramUsername ?? null;
  }

  const { error: updateError } = await client
    .from("customers")
    .update(patch)
    .eq("id", customer.id);

  if (updateError) {
    await logSystem({
      tenant_id: customer.tenant_id as string,
      customer_id: customer.id as string,
      action: "LOGIN_LINK_FAILED",
      resource: email,
      status: "FAILED",
      details: {
        message: updateError.message,
      },
    });

    return {
      ok: false,
      error:
        "Login succeeded but Telegram linking failed. Try again.",
    };
  }

  const token = await createCustomerSession({
    customerId: customer.id as string,
    tenantId: customer.tenant_id as string,
  });

  await logSystem({
    tenant_id: customer.tenant_id as string,
    customer_id: customer.id as string,
    action: "LOGIN",
    resource: email,
  });

  return {
    ok: true,
    token,
    customerId: customer.id as string,
  };
}

export async function registerCustomerFromFlow(
  input: {
    flowToken: string;
    email: string;
    password: string;
    confirmPassword: string;
    name?: string | null;
  },
): Promise<{
  token: string;
  customerId: string;
  tenantId: string;
}> {
  if (
    input.password !== input.confirmPassword
  ) {
    throw new Error(
      "Passwords do not match.",
    );
  }

  const flow = await consumeTelegramFlow(
    input.flowToken,
    "REGISTRATION",
  );

  const flowEmail = normalizeEmail(
    String(flow.payload["email"] ?? ""),
  );

  const email = normalizeEmail(input.email);

  if (!flowEmail || flowEmail !== email) {
    throw new Error(
      "Use the same email address you entered in Telegram.",
    );
  }

  const res = await registerCustomer({
    email,
    password: input.password,
    name: input.name ?? null,
    telegramUserId: flow.telegramUserId,
    telegramUsername:
      typeof flow.payload[
        "telegram_username"
      ] === "string"
        ? (flow.payload[
            "telegram_username"
          ] as string)
        : null,
  });

  if (!res.ok) {
    throw new Error(res.error);
  }

  if (res.status !== "ACTIVE") {
    await clearTelegramFlow(flow.telegramUserId);
    throw new Error("Your account is pending admin approval.");
  }

  const token =
    await createCustomerSession({
      customerId: res.customerId,
      tenantId: res.tenantId,
    });

  await clearTelegramFlow(
    flow.telegramUserId,
  );

  return {
    token,
    customerId: res.customerId,
    tenantId: res.tenantId,
  };
}

export async function loginCustomerFromFlow(
  input: {
    flowToken: string;
    email: string;
    password: string;
  },
): Promise<{
  token: string;
  customerId: string;
}> {
  const flow = await consumeTelegramFlow(
    input.flowToken,
    "LOGIN",
  );

  const res = await loginCustomer({
    email: input.email,
    password: input.password,
    telegramUserId: flow.telegramUserId,
    telegramUsername:
      typeof flow.payload[
        "telegram_username"
      ] === "string"
        ? (flow.payload[
            "telegram_username"
          ] as string)
        : null,
  });

  if (!res.ok) {
    throw new Error(res.error);
  }

  await clearTelegramFlow(
    flow.telegramUserId,
  );

  return {
    token: res.token,
    customerId: res.customerId,
  };
}

export async function logoutCustomer(
  auth: string | undefined | null,
) {
  if (!auth?.startsWith("sess ")) {
    return { ok: true };
  }

  await db()
    .from("customer_sessions")
    .delete()
    .eq(
      "token_hash",
      hashToken(auth.slice(5)),
    );

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Account Settings                                                           */
/* -------------------------------------------------------------------------- */

export async function getCustomerAccountSettings(
  ctx: AuthContext,
) {
  const { data, error } = await db()
    .from("customers")
    .select("id, email, name")
    .eq("id", ctx.customerId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Account not found.");
  }

  return {
    email: data.email as string,
    name: (data.name as string | null) ?? "",
  };
}

export async function updateCustomerName(
  ctx: AuthContext,
  name: string,
) {
  const value = name.trim();

  if (!value) {
    throw new Error("Name cannot be empty.");
  }

  if (value.length > 80) {
    throw new Error(
      "Name must be 80 characters or less.",
    );
  }

  const { error } = await db()
    .from("customers")
    .update({
      name: value,
    })
    .eq("id", ctx.customerId)
    .eq("tenant_id", ctx.tenantId);

  if (error) {
    throw new Error(error.message);
  }

  await logSystem({
    tenant_id: ctx.tenantId,
    customer_id: ctx.customerId,
    action: "ACCOUNT_NAME_UPDATED",
    resource: ctx.email,
  });

  return {
    ok: true,
    name: value,
  };
}

export async function changeCustomerPassword(
  ctx: AuthContext,
  input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  },
) {
  if (!input.currentPassword) {
    throw new Error(
      "Enter your current password.",
    );
  }

  if (
    !input.newPassword ||
    input.newPassword.length < 8
  ) {
    throw new Error(
      "New password must be at least 8 characters.",
    );
  }

  if (
    input.newPassword !==
    input.confirmPassword
  ) {
    throw new Error(
      "New passwords do not match.",
    );
  }

  const client = db();

  const { data: customer, error } =
    await client
      .from("customers")
      .select("id, password_hash")
      .eq("id", ctx.customerId)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!customer) {
    throw new Error("Account not found.");
  }

  const currentIsValid =
    await verifyPassword(
      input.currentPassword,
      customer.password_hash as string,
    );

  if (!currentIsValid) {
    throw new Error(
      "Current password is incorrect.",
    );
  }

  const sameAsCurrent =
    await verifyPassword(
      input.newPassword,
      customer.password_hash as string,
    );

  if (sameAsCurrent) {
    throw new Error(
      "New password must be different from your current password.",
    );
  }

  const passwordHash =
    await hashPassword(input.newPassword);

  const { error: updateError } =
    await client
      .from("customers")
      .update({
        password_hash: passwordHash,
      })
      .eq("id", ctx.customerId)
      .eq("tenant_id", ctx.tenantId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await logSystem({
    tenant_id: ctx.tenantId,
    customer_id: ctx.customerId,
    action: "ACCOUNT_PASSWORD_CHANGED",
    resource: ctx.email,
  });

  /*
   * Existing customer_sessions are intentionally kept.
   * User stays logged into the current Mini App session.
   */

  return {
    ok: true,
  };
}

/**
 * Resolves the authenticated customer.
 * Never trusts a tenant/customer id from the client.
 *
 * `auth` is either:
 * `tma <telegram initData>`
 * or
 * `sess <session token>`
 */
export async function resolveAuth(
  auth: string | undefined | null,
): Promise<AuthContext> {
  if (!auth) {
    throw new Error("UNAUTHENTICATED");
  }

  const client = db();

  if (auth.startsWith("tma ")) {
    const token = botToken();

    if (!token) {
      throw new Error(
        "BOT_NOT_CONFIGURED",
      );
    }

    const tgUser =
      verifyTelegramInitData(
        auth.slice(4),
        token,
      );

    if (!tgUser) {
      throw new Error("UNAUTHENTICATED");
    }

    const { data } = await client
      .from("customers")
      .select(
        "id, tenant_id, email, name, telegram_user_id, status",
      )
      .eq(
        "telegram_user_id",
        tgUser.id,
      )
      .maybeSingle();

    if (!data) {
      throw new Error("NO_ACCOUNT");
    }

    if (data.status !== "ACTIVE") {
      throw new Error("SUSPENDED");
    }

    return {
      customerId: data.id as string,
      tenantId: data.tenant_id as string,
      email: data.email as string,
      name:
        (data.name as string) ?? null,
      telegramUserId:
        (data.telegram_user_id as number) ??
        null,
    };
  }

  if (auth.startsWith("sess ")) {
    const { data } = await client
      .from("customer_sessions")
      .select(
        "customer_id, tenant_id, expires_at",
      )
      .eq(
        "token_hash",
        hashToken(auth.slice(5)),
      )
      .maybeSingle();

    if (
      !data ||
      new Date(
        data.expires_at as string,
      ) < new Date()
    ) {
      throw new Error("UNAUTHENTICATED");
    }

    const { data: customer } =
      await client
        .from("customers")
        .select(
          "id, tenant_id, email, name, telegram_user_id, status",
        )
        .eq("id", data.customer_id)
        .maybeSingle();

    if (!customer) {
      throw new Error("UNAUTHENTICATED");
    }

    if (customer.status !== "ACTIVE") {
      throw new Error("SUSPENDED");
    }

    return {
      customerId:
        customer.id as string,
      tenantId:
        customer.tenant_id as string,
      email: customer.email as string,
      name:
        (customer.name as string) ??
        null,
      telegramUserId:
        (customer.telegram_user_id as number) ??
        null,
    };
  }

  throw new Error("UNAUTHENTICATED");
}
