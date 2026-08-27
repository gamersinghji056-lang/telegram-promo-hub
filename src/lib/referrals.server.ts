import { db, logAdmin } from "./db.server";
import { telegramSettings } from "./telegram.server";
import type { AuthContext } from "./customer-auth.server";
import { activatePaidInvoice } from "./billing.server";

export const REFERRAL_REWARD_COINS = 100;
export const COINS_PER_USDT = 100;

export function parseReferralStart(text: string) {
  const match = text.trim().match(/^\/start(?:@\w+)?\s+ref_([A-Za-z0-9_-]{20,64})$/i);
  return match?.[1] ?? null;
}

export async function recordReferralClick(code: string, telegramUserId: number, telegramUsername?: string | null) {
  const client = db();
  const { data: referralCode } = await client.from("referral_codes").select("customer_id,tenant_id").eq("code", code).maybeSingle();
  if (!referralCode) return { valid: false };
  const { data: self } = await client.from("customers").select("id").eq("telegram_user_id", telegramUserId).eq("id", referralCode.customer_id).maybeSingle();
  if (self) return { valid: false, reason: "SELF_REFERRAL" };
  const { data: existing } = await client.from("referral_clicks").select("id,click_count").eq("referrer_customer_id", referralCode.customer_id).eq("telegram_user_id", telegramUserId).maybeSingle();
  if (existing) {
    await client.from("referral_clicks").update({ last_clicked_at: new Date().toISOString(), click_count: Number(existing.click_count) + 1, telegram_username: telegramUsername ?? null }).eq("id", existing.id);
  } else {
    await client.from("referral_clicks").insert({ referrer_customer_id: referralCode.customer_id, referrer_tenant_id: referralCode.tenant_id, telegram_user_id: telegramUserId, telegram_username: telegramUsername ?? null });
  }
  return { valid: true };
}

export async function claimPendingReferral(customerId: string, tenantId: string, telegramUserId?: number | null) {
  if (!telegramUserId) return null;
  const { data, error } = await db().rpc("claim_referral_attribution", { p_customer_id: customerId, p_tenant_id: tenantId, p_telegram_user_id: telegramUserId });
  if (error) throw new Error(error.message);
  return data;
}

export async function referralDashboard(ctx: AuthContext) {
  const client = db();
  const { data: code, error } = await client.rpc("ensure_referral_code", { p_tenant_id: ctx.tenantId, p_customer_id: ctx.customerId });
  if (error) throw new Error(error.message);
  const [{ data: wallet }, { data: referrals }, { data: clicks }, { data: ledger }, telegram] = await Promise.all([
    client.from("coin_wallets").select("balance,lifetime_earned,lifetime_spent").eq("customer_id", ctx.customerId).maybeSingle(),
    client.from("customer_referrals").select("id,referred_customer_id,status,registered_at,first_purchase_at,rewarded_at,customers!customer_referrals_referred_customer_id_fkey(telegram_user_id,telegram_username)").eq("referrer_customer_id", ctx.customerId).order("registered_at", { ascending: false }),
    client.from("referral_clicks").select("id,telegram_user_id,telegram_username,clicked_at,last_clicked_at,click_count").eq("referrer_customer_id", ctx.customerId).order("clicked_at", { ascending: false }),
    client.from("coin_ledger").select("id,entry_type,delta,balance_after,reason,created_at,invoice_id,referred_customer_id").eq("customer_id", ctx.customerId).order("created_at", { ascending: false }).limit(50),
    telegramSettings(),
  ]);
  const registeredTelegramIds = new Set((referrals ?? []).map((row) => String((row.customers as { telegram_user_id?: number | null } | null)?.telegram_user_id ?? "")));
  const rows = [
    ...(referrals ?? []).map((row) => ({ ...row, telegram_user_id: (row.customers as { telegram_user_id?: number | null } | null)?.telegram_user_id ?? null, telegram_username: (row.customers as { telegram_username?: string | null } | null)?.telegram_username ?? null })),
    ...(clicks ?? []).filter((click) => !registeredTelegramIds.has(String(click.telegram_user_id))).map((click) => ({ ...click, status: "CLICKED", registered_at: null, first_purchase_at: null, rewarded_at: null })),
  ];
  const bot = telegram.bot_username.replace(/^@/, "") || "wpaypromotionbot";
  return {
    code: code.code,
    link: `https://t.me/${bot}?start=ref_${code.code}`,
    wallet: wallet ?? { balance: 0, lifetime_earned: 0, lifetime_spent: 0 },
    usdtValue: Number(wallet?.balance ?? 0) / COINS_PER_USDT,
    referrals: rows,
    ledger: ledger ?? [],
    summary: {
      totalDirectInvites: (clicks ?? []).length,
      registered: (referrals ?? []).length,
      active: (referrals ?? []).filter((row) => ["ACTIVE", "PURCHASED", "REWARDED"].includes(row.status)).length,
      purchased: (referrals ?? []).filter((row) => row.first_purchase_at).length,
      rewarded: (referrals ?? []).filter((row) => row.rewarded_at).length,
      totalCoinsEarned: Number(wallet?.lifetime_earned ?? 0),
    },
  };
}

export async function reserveInvoiceCoins(ctx: AuthContext, invoiceId: string, coins: number) {
  if (!Number.isInteger(coins) || coins <= 0) throw new Error("Enter a positive whole Coin amount.");
  const { data, error } = await db().rpc("reserve_coins_for_invoice", { p_invoice_id: invoiceId, p_customer_id: ctx.customerId, p_coins: coins });
  if (error) throw new Error(error.message.includes("INSUFFICIENT") ? "Insufficient Coin balance." : error.message);
  if (Number(data.payable_amount) === 0) {
    await activatePaidInvoice(invoiceId, "COINS", null, "Paid fully with platform Coins");
    const { data: paid } = await db().from("billing_invoices").select("*").eq("id", invoiceId).eq("tenant_id", ctx.tenantId).single();
    return paid;
  }
  return data;
}

export async function adminReferralOverview() {
  const client = db();
  const [{ data: referrals }, { data: wallets }, { data: ledger }] = await Promise.all([
    client.from("customer_referrals").select("*,referrer:customers!customer_referrals_referrer_customer_id_fkey(email,telegram_username),referred:customers!customer_referrals_referred_customer_id_fkey(email,telegram_username)").order("registered_at", { ascending: false }).limit(200),
    client.from("coin_wallets").select("*,customers(email,telegram_username)").order("balance", { ascending: false }).limit(200),
    client.from("coin_ledger").select("*").order("created_at", { ascending: false }).limit(200),
  ]);
  return { referrals: referrals ?? [], wallets: wallets ?? [], ledger: ledger ?? [] };
}

export async function adminAdjustCoins(adminId: string, customerId: string, amount: number, reason: string) {
  if (!Number.isInteger(amount) || amount === 0 || !reason.trim()) throw new Error("A non-zero whole Coin amount and reason are required.");
  const { data, error } = await db().rpc("adjust_coin_wallet", { p_customer_id: customerId, p_amount: amount, p_reason: reason.trim(), p_admin_id: adminId });
  if (error) throw new Error(error.message.includes("INSUFFICIENT") ? "Adjustment would make the balance negative." : error.message);
  await logAdmin({ admin_user_id: adminId, action: "COIN_WALLET_ADJUSTED", resource: customerId, details: { amount, reason: reason.trim() } });
  return data;
}

export async function adminReverseReferralReward(adminId: string, invoiceId: string, reason: string) {
  if (!invoiceId || !reason.trim()) throw new Error("Invoice and reversal reason are required.");
  const { data, error } = await db().rpc("reverse_referral_reward", { p_invoice_id: invoiceId, p_reason: reason.trim(), p_admin_id: adminId });
  if (error) throw new Error(error.message.includes("ADMIN_REVIEW_REQUIRED") ? "Admin review required: the rewarded Coins have already been spent." : error.message);
  await logAdmin({ admin_user_id: adminId, action: "REFERRAL_REWARD_REVERSED", resource: invoiceId, details: { reason: reason.trim(), reversed: Boolean(data) } });
  return { reversed: Boolean(data) };
}
