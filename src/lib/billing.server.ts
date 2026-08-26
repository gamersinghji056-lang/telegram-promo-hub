import { createHash } from "node:crypto";
import { db, getSetting, logAdmin, logSystem, notify } from "./db.server";

export const OFFICIAL_PLAN_CODES = ["TEST", "PLUS", "PRO", "ENTERPRISE"] as const;
export const PLAN_RANK: Record<string, number> = { TEST: 0, PLUS: 1, PRO: 2, ENTERPRISE: 3 };
export const PREMIUM_EMOJI_CODE = "premium_emoji";
export const ADD_USERS_CREDITS_CODE = "add_users_credits";
export const ADD_USERS_CREDITS_PRICE_USD = 5;
export const ADD_USERS_CREDITS_QUANTITY = 1000;
export const TRON_MAINNET_USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
export const LEGACY_WRONG_TRON_USDT_CONTRACTS = ["TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj"];
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
  receiving_address?: string;
  invoice_expiry_minutes?: number;
  usdt_contract?: string;
  confirmations_required?: number;
};

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Decode(value: string) {
  let num = 0n;
  for (const char of value) {
    const index = BASE58_ALPHABET.indexOf(char);
    if (index < 0) return null;
    num = num * 58n + BigInt(index);
  }
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xffn));
    num >>= 8n;
  }
  for (const char of value) {
    if (char !== "1") break;
    bytes.unshift(0);
  }
  return Buffer.from(bytes);
}

function checksum(payload: Buffer) {
  return createHash("sha256").update(createHash("sha256").update(payload).digest()).digest().subarray(0, 4);
}

export function normalizeTronAddress(value?: string | null) {
  return String(value ?? "").trim();
}

export function isValidTronAddress(value?: string | null) {
  const address = normalizeTronAddress(value);
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) return false;
  const decoded = base58Decode(address);
  if (!decoded || decoded.length !== 25) return false;
  const payload = decoded.subarray(0, 21);
  if (payload[0] !== 0x41) return false;
  return checksum(payload).equals(decoded.subarray(21));
}

export function normalizePaymentSettings(input: PaymentSettings): PaymentSettings {
  const wallet = normalizeTronAddress(input.wallet_address ?? input.receiving_address);
  return {
    payment_enabled: input.payment_enabled === true,
    network: "TRC20",
    tron_network: "mainnet",
    wallet_address: wallet,
    invoice_expiry_minutes: Math.max(1, Math.floor(Number(input.invoice_expiry_minutes ?? INVOICE_MINUTES))),
    usdt_contract: TRON_MAINNET_USDT_CONTRACT,
    confirmations_required: Math.max(1, Math.floor(Number(input.confirmations_required ?? 1))),
  };
}

export function usdtContract(settings: PaymentSettings) {
  return settings.usdt_contract?.trim() || TRON_MAINNET_USDT_CONTRACT;
}

export function tronLinkUrl(invoice: Record<string, unknown>) {
  const params = new URLSearchParams();
  params.set("param", JSON.stringify({
    action: "transfer",
    actionId: String(invoice["invoice_number"] ?? invoice["id"] ?? ""),
    url: "https://telegram-promo-hub-production.up.railway.app/mini-app/billing",
    callbackUrl: "https://telegram-promo-hub-production.up.railway.app/api/public/tronlink/callback",
    dappName: "WPAY",
    protocol: "TronLink",
    version: "1.0",
    chainId: "0x2b6653dc",
    tokenId: "",
    contract: String(invoice["token_contract"] ?? TRON_MAINNET_USDT_CONTRACT),
    to: String(invoice["receiving_address"] ?? ""),
    amount: String(invoice["payable_amount"] ?? ""),
    memo: String(invoice["invoice_number"] ?? invoice["id"] ?? ""),
  }));
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

export async function addUsersCreditBalance(tenantId: string) {
  const { data, error } = await db().rpc("add_users_credit_capacity", { p_tenant_id: tenantId });
  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (message.includes("add_users_credit") || message.includes("tenant_add_users_credits") || message.includes("does not exist")) {
      return {
        purchased_balance: 0,
        free_trial_used: 0,
        free_trial_remaining: 5,
        available_capacity: 5,
        successful_additions: 0,
        credits_consumed: 0,
        migrationRequired: true,
      };
    }
    throw new Error(error.message);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    purchased_balance: Number(row?.purchased_balance ?? 0),
    free_trial_used: Number(row?.free_trial_used ?? 0),
    free_trial_remaining: Number(row?.free_trial_remaining ?? 5),
    available_capacity: Number(row?.available_capacity ?? 5),
    successful_additions: Number(row?.successful_additions ?? 0),
    credits_consumed: Number(row?.credits_consumed ?? 0),
  };
}

export async function expireInvoices() {
  const { data } = await db().rpc("expire_stale_billing_invoices");
  return Number(data ?? 0);
}

async function paymentSettings() {
  const settings = normalizePaymentSettings(await getSetting<PaymentSettings>("payments"));
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
    console.info("ENTITLEMENT_ACTIVATED", { invoice_id: invoiceId, tenant_id: paid.tenant_id, product_type: "PLAN", product_code: paid.product_code });
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
    console.info("ENTITLEMENT_ACTIVATED", { invoice_id: invoiceId, tenant_id: paid.tenant_id, product_type: "ADDON", product_code: paid.product_code });
  } else if (paid.product_code === ADD_USERS_CREDITS_CODE.toUpperCase()) {
    const { error } = await client.rpc("grant_add_users_credits", {
      p_tenant_id: paid.tenant_id,
      p_amount: ADD_USERS_CREDITS_QUANTITY,
      p_reason: "Add Users credits invoice paid",
      p_admin_id: actor === "ADMIN" ? adminId : null,
      p_invoice_id: paid.id,
    });
    if (error) throw new Error(error.message);
    await notify(paid.tenant_id, "Add Users credits added", "1,000 Add Users credits are ready.", "SUCCESS", "/mini-app/billing");
    console.info("ENTITLEMENT_ACTIVATED", { invoice_id: invoiceId, tenant_id: paid.tenant_id, product_type: "ADDON", product_code: paid.product_code });
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
  if (existingEvent.data?.invoice_id) return { ok: true, duplicate: true, invoiceId: String(existingEvent.data.invoice_id) };
  console.info("TRANSFER_FOUND", {
    network: event.network,
    token_contract: event.tokenContract,
    tx_hash: txHash,
    to_address: event.toAddress,
    normalized_amount: event.normalizedAmount.toFixed(6),
    transaction_timestamp: event.transactionTimestamp ?? null,
  });

  let invoice = null as Record<string, unknown> | null;
  const invoiceQuery = (tokenContracts: string[]) => client.from("billing_invoices")
    .select("*")
    .eq("network", event.network.toUpperCase())
    .in("token_contract", tokenContracts)
    .eq("receiving_address", event.toAddress)
    .eq("payable_amount", event.normalizedAmount.toFixed(6))
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const exact = await invoiceQuery([event.tokenContract]);
  invoice = (exact.data as Record<string, unknown> | null) ?? null;
  if (!invoice && event.tokenContract === TRON_MAINNET_USDT_CONTRACT) {
    const legacy = await invoiceQuery(LEGACY_WRONG_TRON_USDT_CONTRACTS);
    invoice = (legacy.data as Record<string, unknown> | null) ?? null;
    if (invoice) {
      await client.from("billing_invoices").update({ token_contract: TRON_MAINNET_USDT_CONTRACT, updated_at: new Date().toISOString() }).eq("id", invoice.id as string);
      invoice = { ...invoice, token_contract: TRON_MAINNET_USDT_CONTRACT };
    }
  }

  let status: InvoiceStatus = "REVIEW_REQUIRED";
  let classification = "NO_MATCH";
  let review = "No active invoice matched this exact amount.";
  if (invoice) {
    console.info("INVOICE_MATCHED", { invoice_id: invoice.id, tx_hash: txHash, status: invoice.status, payable_amount: invoice.payable_amount });
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

  if (!invoice) {
    console.info("TRANSFER_REJECTED", { reason: "NO_MATCH", tx_hash: txHash, to_address: event.toAddress, normalized_amount: event.normalizedAmount.toFixed(6) });
    return { ok: true, classification };
  }

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
  if (status === "CONFIRMING") {
    console.info("INVOICE_DETECTED", { invoice_id: invoice.id, tx_hash: txHash });
    console.info("INVOICE_CONFIRMING", { invoice_id: invoice.id, tx_hash: txHash });
  } else {
    console.info("TRANSFER_REJECTED", { reason: classification, invoice_id: invoice.id, tx_hash: txHash });
  }
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
    console.info("INVOICE_CONFIRMED", { invoice_id: invoice.id, tx_hash: txHash });
  }
  return { ok: true, classification, invoiceId: String(invoice.id) };
}

function addonExpiryFromInput(currentExpiry: string | null | undefined, input: { duration?: string; expiresAt?: string | null; noExpiry?: boolean; action?: "GRANT" | "EXTEND" }) {
  if (input.noExpiry || input.duration === "NO_EXPIRY") return null;
  if (input.duration === "CUSTOM") {
    if (!input.expiresAt) throw new Error("Custom expiry date is required.");
    return new Date(input.expiresAt).toISOString();
  }
  const days = Number(input.duration ?? 30);
  if (!Number.isFinite(days) || days < 1) throw new Error("Invalid add-on duration.");
  const current = currentExpiry ? new Date(currentExpiry).getTime() : 0;
  const base = input.action === "EXTEND" ? Math.max(Date.now(), Number.isFinite(current) ? current : 0) : Date.now();
  return new Date(base + days * 86400_000).toISOString();
}

export async function grantPremiumEmoji(adminId: string, tenantId: string, input: { duration?: string; expiresAt?: string | null; noExpiry?: boolean; action?: "GRANT" | "EXTEND"; reason?: string | null; revoke?: boolean }) {
  const now = new Date().toISOString();
  const current = await premiumEmojiEntitlement(tenantId);
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
  const expiresAt = addonExpiryFromInput(current.entitlement?.expires_at as string | null | undefined, input);
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
  await logAdmin({
    admin_user_id: adminId,
    action: input.action === "EXTEND" ? "PREMIUM_EMOJI_EXTENDED" : "PREMIUM_EMOJI_GRANTED",
    resource: tenantId,
    details: { old_expires_at: current.entitlement?.expires_at ?? null, expires_at: expiresAt, reason: input.reason ?? null },
  });
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
