import { db, getSetting, logAdmin, logSystem, notify } from "./db.server";

export const OFFICIAL_PLAN_CODES = ["TEST", "PLUS", "PRO", "ENTERPRISE"] as const;
export const PLAN_RANK: Record<string, number> = { TEST: 0, PLUS: 1, PRO: 2, ENTERPRISE: 3 };
export const PREMIUM_EMOJI_CODE = "premium_emoji";
export const TRON_MAINNET_USDT_CONTRACT = "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj";
const INVOICE_MINUTES = 10;

type InvoiceStatus =
  | "PENDING"
  | "PAYMENT_DETECTED"
  | "CONFIRMING"
  | "PAID"
  | "EXPIRED"
  | "CANCELLED"
  | "UNDERPAID"
  | "OVERPAID"
  | "LATE_PAYMENT"
  | "REVIEW_REQUIRED";

export type InvoiceProductType = "PLAN" | "ADDON";

export type PaymentSettings = {
  payment_enabled?: boolean;
  network?: string;
  tron_network?: string;
  wallet_address?: string;
  invoice_expiry_minutes?: number;
  usdt_contract?: string;
  confirmations_required?: number;
};

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

export function isValidTronAddress(value?: string | null) {
  return Boolean(value && /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value.trim()));
}

export function usdtContract(settings: PaymentSettings) {
  return settings.usdt_contract?.trim() || TRON_MAINNET_USDT_CONTRACT;
}

export function tronLinkUrl(invoice: Record<string, unknown>) {
  const params = new URLSearchParams({
    action: "transfer",
    network: "mainnet",
    token: "USDT",
    contract: String(invoice["token_contract"] ?? TRON_MAINNET_USDT_CONTRACT),
    to: String(invoice["receiving_address"] ?? ""),
    amount: String(invoice["payable_amount"] ?? ""),
    memo: String(invoice["invoice_number"] ?? invoice["id"] ?? ""),
  });
  return `tronlinkoutside://pull.activity?${params.toString()}`;
}

export function tronscanTxUrl(txHash?: string | null) {
  return txHash ? `https://tronscan.org/#/transaction/${encodeURIComponent(txHash)}` : "";
}

export async function officialPlans() {
  const { data } = await db()
    .from("plans")
    .select("*")
    .in("code", OFFICIAL_PLAN_CODES)
    .eq("is_active", true)
    .order("sort_order");
  const byCode = new Map((data ?? []).map((plan) => [String(plan.code).toUpperCase(), plan]));
  return OFFICIAL_PLAN_CODES.map((code) => byCode.get(code)).filter(Boolean);
}

export async function premiumEmojiSettings() {
  const addons = await getSetting<{ premium_emoji?: { enabled?: boolean; price_usd?: number; duration_days?: number } }>("addons");
  return {
    enabled: addons.premium_emoji?.enabled !== false,
    price_usd: Number(addons.premium_emoji?.price_usd ?? 20),
    duration_days: Number(addons.premium_emoji?.duration_days ?? 30),
  };
}

export async function expireInvoices() {
  const { data } = await db().rpc("expire_stale_billing_invoices");
  return Number(data ?? 0);
}

async function paymentSettings() {
  const settings = await getSetting<PaymentSettings>("payments");
  if (!settings.payment_enabled) throw new Error("Payment address is not configured.");
  if ((settings.network ?? "TRC20").toUpperCase() !== "TRC20" && (settings.network ?? "TRON").toUpperCase() !== "TRON") {
    throw new Error("Unsupported payment network.");
  }
  if (!isValidTronAddress(settings.wallet_address)) throw new Error("Payment address is not configured.");
  return settings;
}

function publicInvoice(invoice: Record<string, unknown>) {
  return {
    ...invoice,
    qr_payload: String(invoice["receiving_address"] ?? ""),
    tronlink_url: tronLinkUrl(invoice),
    tronscan_url: tronscanTxUrl(String(invoice["tx_hash"] ?? "")),
  };
}

async function insertBillingTransaction(invoice: Record<string, unknown>) {
  const client = db();
  const { data: existing } = await client
    .from("billing_transactions")
    .select("id")
    .eq("invoice_id", invoice["id"] as string)
    .maybeSingle();
  if (existing) return;
  const { error } = await client.from("billing_transactions").insert({
    tenant_id: invoice["tenant_id"],
    plan_id: invoice["plan_id"] || null,
    invoice_id: invoice["id"],
    product_type: invoice["product_type"],
    product_code: invoice["product_code"],
    amount: invoice["payable_amount"],
    base_price: invoice["base_price"],
    invoice_payable_amount: invoice["payable_amount"],
    currency: "USDT",
    network: "TRON",
    wallet_address: invoice["receiving_address"],
    status: "PENDING",
  });
  if (error) throw new Error(error.message);
}

export async function createInvoice(input: {
  tenantId: string;
  productType: InvoiceProductType;
  productCode: string;
  planId?: string | null;
  basePrice: number;
  replace?: boolean;
}) {
  if (input.basePrice <= 0) throw new Error("Only paid products require invoices.");
  const settings = await paymentSettings();
  const { data, error } = await db().rpc("create_usdt_billing_invoice", {
    p_tenant_id: input.tenantId,
    p_product_type: input.productType,
    p_product_code: normalizeCode(input.productCode),
    p_plan_id: input.planId ?? null,
    p_base_price: input.basePrice,
    p_receiving_address: settings.wallet_address,
    p_network: "TRON",
    p_token_contract: usdtContract(settings),
    p_replace: Boolean(input.replace),
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("ACTIVE_INVOICE_EXISTS:")) {
      const [, id, code, type] = message.match(/ACTIVE_INVOICE_EXISTS:([^:]+):([^:]+):([^:]+)/) ?? [];
      const err = new Error(`You already have an active ${code} payment invoice. Replace it with ${input.productCode}?`);
      Object.assign(err, { code: "ACTIVE_INVOICE_EXISTS", activeInvoiceId: id, activeProductCode: code, activeProductType: type });
      throw err;
    }
    throw new Error(message);
  }
  await insertBillingTransaction(data as Record<string, unknown>);
  return publicInvoice(data as Record<string, unknown>);
}

export async function activeInvoice(tenantId: string) {
  await expireInvoices();
  const { data } = await db()
    .from("billing_invoices")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("status", ["PENDING", "PAYMENT_DETECTED", "CONFIRMING"])
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? publicInvoice(data) : null;
}

export async function invoiceByIdForTenant(tenantId: string, invoiceId: string) {
  await expireInvoices();
  const { data } = await db()
    .from("billing_invoices")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", invoiceId)
    .maybeSingle();
  if (!data) throw new Error("Invoice not found.");
  return publicInvoice(data);
}

export async function activatePaidInvoice(invoiceId: string, actor: "BLOCKCHAIN" | "ADMIN", adminId?: string | null, reason?: string | null) {
  const client = db();
  const { data: invoice } = await client.from("billing_invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "PAID") return { ok: true, alreadyPaid: true };
  if (!["PAYMENT_DETECTED", "CONFIRMING", "REVIEW_REQUIRED"].includes(String(invoice.status)) && actor !== "ADMIN") {
    throw new Error("Invoice is not ready for activation.");
  }

  const now = new Date().toISOString();
  const { data: paid } = await client
    .from("billing_invoices")
    .update({ status: "PAID", paid_at: now, confirmed_at: now, updated_at: now, review_reason: reason ?? invoice.review_reason ?? null })
    .eq("id", invoiceId)
    .neq("status", "PAID")
    .select("*")
    .maybeSingle();
  if (!paid) return { ok: true, alreadyPaid: true };

  await client
    .from("billing_transactions")
    .update({
      status: "CONFIRMED",
      tx_hash: paid.tx_hash,
      paid_at: now,
      detected_at: paid.detected_at,
      confirmed_at: now,
      confirmed_by: actor === "ADMIN" ? adminId : null,
      blockchain_status: paid.blockchain_status,
      review_reason: reason ?? paid.review_reason ?? null,
      updated_at: now,
    })
    .eq("invoice_id", invoiceId);

  if (paid.product_type === "PLAN") {
    const { data: plan } = await client.from("plans").select("*").eq("id", paid.plan_id).maybeSingle();
    if (!plan) throw new Error("Plan not found.");
    const expires = Number(plan.duration_days ?? 30) > 0
      ? new Date(Date.now() + Number(plan.duration_days ?? 30) * 86400_000).toISOString()
      : null;
    await client.from("tenants").update({ plan_id: plan.id, plan_expires_at: expires, updated_at: now }).eq("id", paid.tenant_id);
    const { data: existingSub } = await client
      .from("subscriptions")
      .select("id")
      .eq("tenant_id", paid.tenant_id)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingSub) await client.from("subscriptions").update({ status: "EXPIRED", updated_at: now }).eq("id", existingSub.id);
    await client.from("subscriptions").insert({
      tenant_id: paid.tenant_id,
      plan_id: plan.id,
      status: "ACTIVE",
      payment_status: actor === "ADMIN" ? "MANUAL" : "PAID",
      expires_at: expires,
      no_expiry: expires === null,
      granted_by: actor === "ADMIN" ? adminId : null,
      grant_reason: reason ?? (actor === "ADMIN" ? "Manual invoice confirmation" : "Verified TRON USDT payment"),
      metadata: { invoice_id: invoiceId, tx_hash: paid.tx_hash },
    });
    await client.from("tenant_entitlement_overrides").delete().eq("tenant_id", paid.tenant_id);
    await notify(paid.tenant_id, "Plan activated", `Your ${plan.name} plan is active.`, "SUCCESS", "/mini-app/billing");
  } else if (paid.product_code === PREMIUM_EMOJI_CODE.toUpperCase()) {
    const settings = await premiumEmojiSettings();
    const expires = new Date(Date.now() + settings.duration_days * 86400_000).toISOString();
    await client.from("tenant_addon_entitlements").upsert(
      {
        tenant_id: paid.tenant_id,
        addon_code: PREMIUM_EMOJI_CODE,
        status: "ACTIVE",
        source: actor === "ADMIN" ? "ADMIN" : "PAID",
        starts_at: now,
        expires_at: expires,
        no_expiry: false,
        granted_by: actor === "ADMIN" ? adminId : null,
        grant_reason: reason ?? "Premium Emoji invoice paid",
        updated_at: now,
        metadata: { invoice_id: invoiceId, tx_hash: paid.tx_hash },
      },
      { onConflict: "tenant_id,addon_code" },
    );
    await notify(paid.tenant_id, "Premium Emoji activated", "WPAY Premium Emoji composer is active.", "SUCCESS", "/mini-app/billing");
  }

  await logSystem({
    tenant_id: paid.tenant_id,
    action: actor === "ADMIN" ? "INVOICE_MANUALLY_CONFIRMED" : "INVOICE_PAID",
    resource: invoiceId,
    details: { product_type: paid.product_type, product_code: paid.product_code, tx_hash: paid.tx_hash, actor },
  });
  if (actor === "ADMIN") {
    await logAdmin({ admin_user_id: adminId ?? null, action: "INVOICE_MANUALLY_CONFIRMED", resource: invoiceId, details: { reason } });
  }
  return { ok: true };
}

export async function classifyAndRecordPayment(event: {
  network: string;
  tokenContract: string;
  txHash: string;
  fromAddress?: string | null;
  toAddress: string;
  rawTokenAmount: string;
  normalizedAmount: number;
  blockNumber?: number | null;
  transactionTimestamp?: string | null;
  rawEvent?: Record<string, unknown>;
}) {
  const client = db();
  const txHash = event.txHash.trim();
  const existingEvent = await client.from("blockchain_payment_events").select("id, invoice_id").eq("tx_hash", txHash).maybeSingle();
  if (existingEvent.data?.invoice_id) return { ok: true, duplicate: true, invoiceId: existingEvent.data.invoice_id };

  const { data: invoice } = await client
    .from("billing_invoices")
    .select("*")
    .eq("network", event.network.toUpperCase())
    .eq("token_contract", event.tokenContract)
    .eq("receiving_address", event.toAddress)
    .eq("payable_amount", event.normalizedAmount.toFixed(6))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let status: InvoiceStatus = "REVIEW_REQUIRED";
  let classification = "NO_MATCH";
  let review = "No active invoice matched this exact amount.";
  if (invoice) {
    const sentAt = event.transactionTimestamp ? new Date(event.transactionTimestamp) : new Date();
    const expiredAt = new Date(invoice.expires_at as string);
    if (invoice.status === "CANCELLED") {
      status = "REVIEW_REQUIRED";
      classification = "CANCELLED_INVOICE_PAYMENT";
      review = "Payment arrived for a cancelled invoice.";
    } else if (sentAt > expiredAt) {
      status = "LATE_PAYMENT";
      classification = "LATE_PAYMENT";
      review = "Payment was sent after invoice expiry.";
    } else if (Number(event.normalizedAmount.toFixed(6)) < Number(invoice.payable_amount)) {
      status = "UNDERPAID";
      classification = "UNDERPAID";
      review = "Wrong amount received. Admin review required.";
    } else if (Number(event.normalizedAmount.toFixed(6)) > Number(invoice.payable_amount)) {
      status = "OVERPAID";
      classification = "OVERPAID";
      review = "Overpayment received. Admin review required.";
    } else {
      status = "CONFIRMING";
      classification = "EXACT_MATCH";
      review = "";
    }
  }

  await client.from("blockchain_payment_events").upsert(
    {
      invoice_id: invoice?.id ?? null,
      tenant_id: invoice?.tenant_id ?? null,
      network: event.network.toUpperCase(),
      token_contract: event.tokenContract,
      tx_hash: txHash,
      from_address: event.fromAddress ?? null,
      to_address: event.toAddress,
      raw_token_amount: event.rawTokenAmount,
      normalized_amount: event.normalizedAmount.toFixed(6),
      block_number: event.blockNumber ?? null,
      transaction_timestamp: event.transactionTimestamp ?? null,
      confirmation_status: "CONFIRMED",
      classification,
      raw_event: event.rawEvent ?? {},
      confirmed_at: new Date().toISOString(),
    },
    { onConflict: "network,tx_hash" },
  );

  if (!invoice) return { ok: true, classification };

  const patch = {
    status,
    tx_hash: txHash,
    from_address: event.fromAddress ?? null,
    to_address: event.toAddress,
    raw_token_amount: event.rawTokenAmount,
    normalized_amount: event.normalizedAmount.toFixed(6),
    block_number: event.blockNumber ?? null,
    transaction_timestamp: event.transactionTimestamp ?? null,
    blockchain_status: "CONFIRMED",
    detected_at: new Date().toISOString(),
    confirmed_at: status === "CONFIRMING" ? new Date().toISOString() : null,
    review_reason: review || null,
    updated_at: new Date().toISOString(),
  };
  await client.from("billing_invoices").update(patch).eq("id", invoice.id);
  await client
    .from("billing_transactions")
    .update({
      status: status === "CONFIRMING" ? "CONFIRMING" : status,
      tx_hash: txHash,
      detected_at: patch.detected_at,
      confirmed_at: patch.confirmed_at,
      blockchain_status: "CONFIRMED",
      review_reason: review || null,
      updated_at: patch.updated_at,
    })
    .eq("invoice_id", invoice.id);

  if (status === "CONFIRMING") {
    await activatePaidInvoice(invoice.id as string, "BLOCKCHAIN");
  }
  return { ok: true, classification, invoiceId: invoice.id };
}

export async function grantPremiumEmoji(adminId: string, tenantId: string, input: { expiresAt?: string | null; noExpiry?: boolean; reason?: string | null; revoke?: boolean }) {
  const now = new Date().toISOString();
  if (input.revoke) {
    await db().from("tenant_addon_entitlements").upsert(
      {
        tenant_id: tenantId,
        addon_code: PREMIUM_EMOJI_CODE,
        status: "REVOKED",
        source: "ADMIN",
        revoked_at: now,
        granted_by: adminId,
        grant_reason: input.reason ?? "Admin revoked Premium Emoji",
        updated_at: now,
      },
      { onConflict: "tenant_id,addon_code" },
    );
    await logAdmin({ admin_user_id: adminId, action: "PREMIUM_EMOJI_REVOKED", resource: tenantId, details: { reason: input.reason ?? null } });
    return { ok: true };
  }
  const expiresAt = input.noExpiry ? null : input.expiresAt ? new Date(input.expiresAt).toISOString() : new Date(Date.now() + 30 * 86400_000).toISOString();
  await db().from("tenant_addon_entitlements").upsert(
    {
      tenant_id: tenantId,
      addon_code: PREMIUM_EMOJI_CODE,
      status: "ACTIVE",
      source: "ADMIN",
      starts_at: now,
      expires_at: expiresAt,
      no_expiry: input.noExpiry === true,
      granted_by: adminId,
      grant_reason: input.reason ?? "Admin granted Premium Emoji",
      revoked_at: null,
      updated_at: now,
    },
    { onConflict: "tenant_id,addon_code" },
  );
  await logAdmin({ admin_user_id: adminId, action: "PREMIUM_EMOJI_GRANTED", resource: tenantId, details: { expires_at: expiresAt, reason: input.reason ?? null } });
  return { ok: true };
}

export async function premiumEmojiEntitlement(tenantId: string) {
  const { data } = await db()
    .from("tenant_addon_entitlements")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("addon_code", PREMIUM_EMOJI_CODE)
    .maybeSingle();
  const active = Boolean(data && data.status === "ACTIVE" && (data.no_expiry || !data.expires_at || new Date(data.expires_at as string) > new Date()));
  return { active, entitlement: data ?? null };
}
