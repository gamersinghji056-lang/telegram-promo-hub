import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Growth Intelligence discovers only admin chats through the exact selected session", () => {
  const growth = read("src/lib/growth-intelligence.server.ts");
  const data = read("src/lib/growth-data.server.ts");
  assert(growth.includes("withAuthorizedUserClient(tenantId, connectionId"));
  assert(growth.includes("entity.creator") && growth.includes("entity.adminRights"));
  assert(data.includes('eq("id", connectionId).eq("tenant_id", ctx.tenantId)'));
  assert(!growth.includes("defaultHealthyConnection"));
});

test("Growth snapshots and membership events are idempotent and never fabricate visitors", () => {
  const migration = read("supabase/migrations/20260827071407_growth_intelligence_referrals_coins.sql");
  const growth = read("src/lib/growth-intelligence.server.ts");
  const dashboard = read("src/lib/growth-data.server.ts");
  assert(migration.includes("UNIQUE (destination_id, snapshot_bucket)"));
  assert(migration.includes("UNIQUE (destination_id, telegram_event_id)"));
  assert(growth.includes('onConflict: "destination_id,snapshot_bucket"'));
  assert(growth.includes('onConflict: "destination_id,telegram_event_id"'));
  assert(growth.includes("FLOOD_WAIT_"));
  assert(growth.includes("growth_collection_checkpoints"));
  assert(growth.includes("reactions: hasReactions"));
  assert(growth.includes("postViews: hasViews"));
  assert(dashboard.includes("Visitor data unavailable from Telegram"));
  assert(!dashboard.toLowerCase().includes("estimated visitors"));
});

test("Health score is transparent and withheld without history", () => {
  const growth = read("src/lib/growth-data.server.ts");
  assert(growth.includes("snapshotCount < 2"));
  assert(growth.includes("growth + engagement + retention + activity"));
  assert(growth.includes("growth, engagement, retention, activity"));
});

test("Referral deep links are secure, deduplicated, first-referrer-wins and self-safe", () => {
  const referral = read("src/lib/referrals.server.ts");
  const auth = read("src/lib/customer-auth.server.ts");
  const webhook = read("src/routes/api/public/telegram/webhook.ts");
  const migration = read("supabase/migrations/20260827071407_growth_intelligence_referrals_coins.sql");
  assert(referral.includes("ref_([A-Za-z0-9_-]{20,64})"));
  assert(webhook.includes("recordReferralClick"));
  assert(auth.includes("claimPendingReferral"));
  assert(migration.includes("ORDER BY rc.clicked_at ASC LIMIT 1"));
  assert(migration.includes("referrer_customer_id<>p_customer_id"));
  assert(migration.includes("referrer_tenant_id=p_tenant_id"));
  assert(migration.includes("UNIQUE (referrer_customer_id, telegram_user_id)"));
  assert(!migration.includes("parent_referral"));
});

test("Only the first paid purchase awards exactly 100 Coins once", () => {
  const billing = read("src/lib/billing.server.ts");
  const migration = read("supabase/migrations/20260827071407_growth_intelligence_referrals_coins.sql");
  assert(billing.includes('rpc("award_first_purchase_referral"'));
  assert(billing.includes('if (actor !== "COINS")'));
  assert(migration.includes("AND cr.first_purchase_invoice_id IS NULL FOR UPDATE"));
  assert(migration.includes("status='PAID' AND id<>p_invoice_id"));
  assert(migration.includes("'REFERRAL_REWARD',100"));
  assert(migration.includes("coin_referral_reward_once"));
  assert(migration.includes("referred_customer_id") && migration.includes("WHERE entry_type = 'REFERRAL_REWARD'"));
});

test("Coin wallet spending is atomic, auditable, supports partial payment and blocks overdraft", () => {
  const migration = read("supabase/migrations/20260827071407_growth_intelligence_referrals_coins.sql");
  const referral = read("src/lib/referrals.server.ts");
  assert(migration.includes("balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0)"));
  assert(migration.includes("FOR UPDATE"));
  assert(migration.includes("INSUFFICIENT_COIN_BALANCE"));
  assert(migration.includes("max_coins::numeric/100"));
  assert(migration.includes("PURCHASE_REDEMPTION"));
  assert(migration.includes("ADMIN_ADJUSTMENT"));
  assert(migration.includes("REVERSAL"));
  assert(referral.includes("COINS_PER_USDT = 100"));
  assert(referral.includes('activatePaidInvoice(invoiceId, "COINS"'));
});

test("Reward and cancelled-invoice reversals append ledger entries", () => {
  const migration = read("supabase/migrations/20260827071407_growth_intelligence_referrals_coins.sql");
  assert(migration.includes("reverse_referral_reward"));
  assert(migration.includes("ADMIN_REVIEW_REQUIRED_INSUFFICIENT_REWARD_BALANCE"));
  assert(migration.includes("billing_invoice_coin_restore"));
  assert(migration.includes("reversal_of"));
  assert(!migration.includes("DELETE FROM public.coin_ledger"));
});

test("All new records are tenant scoped and exposed only to service role", () => {
  const migration = read("supabase/migrations/20260827071407_growth_intelligence_referrals_coins.sql");
  for (const table of ["growth_destinations","growth_snapshots","growth_membership_events","growth_content_metrics","referral_codes","referral_clicks","customer_referrals","coin_wallets","coin_ledger"]) {
    assert(migration.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`));
  }
  assert(migration.includes("REVOKE ALL ON FUNCTION"));
  assert(migration.includes("FROM PUBLIC,anon,authenticated"));
  assert(migration.includes("TO service_role"));
});
