-- Growth Intelligence and direct Refer & Earn. Additive, service-role only.

CREATE TABLE public.growth_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.telegram_connections(id) ON DELETE CASCADE,
  telegram_chat_id bigint NOT NULL,
  access_hash text,
  title text NOT NULL,
  username text,
  destination_type text NOT NULL CHECK (destination_type IN ('GROUP','SUPERGROUP','CHANNEL')),
  admin_status text NOT NULL CHECK (admin_status IN ('ADMIN','CREATOR')),
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  member_count integer CHECK (member_count IS NULL OR member_count >= 0),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACCESSIBLE','RECONNECT_REQUIRED','ERROR')),
  last_error_code text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  last_checked_at timestamptz,
  last_collected_at timestamptz,
  next_collect_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, connection_id, telegram_chat_id)
);

CREATE TABLE public.growth_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  destination_id uuid NOT NULL REFERENCES public.growth_destinations(id) ON DELETE CASCADE,
  snapshot_bucket timestamptz NOT NULL,
  member_count integer CHECK (member_count IS NULL OR member_count >= 0),
  message_count integer CHECK (message_count IS NULL OR message_count >= 0),
  reaction_count integer CHECK (reaction_count IS NULL OR reaction_count >= 0),
  post_views bigint CHECK (post_views IS NULL OR post_views >= 0),
  forwards integer CHECK (forwards IS NULL OR forwards >= 0),
  available_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  collected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (destination_id, snapshot_bucket)
);

CREATE TABLE public.growth_membership_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  destination_id uuid NOT NULL REFERENCES public.growth_destinations(id) ON DELETE CASCADE,
  telegram_event_id bigint NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('JOINED','LEFT')),
  telegram_user_id bigint,
  username text,
  display_name text,
  event_at timestamptz NOT NULL,
  source_info jsonb,
  previous_chat_status text CHECK (previous_chat_status IN ('PREVIOUSLY_CHATTED','NO_KNOWN_PREVIOUS_CHAT','UNABLE_TO_VERIFY')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (destination_id, telegram_event_id)
);

CREATE TABLE public.growth_content_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  destination_id uuid NOT NULL REFERENCES public.growth_destinations(id) ON DELETE CASCADE,
  telegram_message_id integer NOT NULL,
  posted_at timestamptz NOT NULL,
  views bigint CHECK (views IS NULL OR views >= 0),
  forwards integer CHECK (forwards IS NULL OR forwards >= 0),
  reactions integer CHECK (reactions IS NULL OR reactions >= 0),
  collected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (destination_id, telegram_message_id)
);

CREATE TABLE public.growth_collection_checkpoints (
  destination_id uuid NOT NULL REFERENCES public.growth_destinations(id) ON DELETE CASCADE,
  collection_type text NOT NULL CHECK (collection_type IN ('ADMIN_LOG','MESSAGES','SNAPSHOT')),
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_error_code text,
  flood_wait_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (destination_id, collection_type)
);

CREATE INDEX growth_destinations_due_idx ON public.growth_destinations(status, next_collect_at);
CREATE INDEX growth_snapshots_tenant_time_idx ON public.growth_snapshots(tenant_id, snapshot_bucket DESC);
CREATE INDEX growth_events_tenant_time_idx ON public.growth_membership_events(tenant_id, event_at DESC);

CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Za-z0-9_-]{20,64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  referrer_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  telegram_user_id bigint NOT NULL,
  telegram_username text,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  last_clicked_at timestamptz NOT NULL DEFAULT now(),
  click_count integer NOT NULL DEFAULT 1 CHECK (click_count > 0),
  UNIQUE (referrer_customer_id, telegram_user_id)
);

CREATE TABLE public.customer_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  referrer_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  referred_customer_id uuid NOT NULL UNIQUE REFERENCES public.customers(id) ON DELETE RESTRICT,
  referred_tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE RESTRICT,
  referral_click_id uuid REFERENCES public.referral_clicks(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED','ACTIVE','PURCHASED','REWARDED')),
  registered_at timestamptz NOT NULL DEFAULT now(),
  first_purchase_invoice_id uuid REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  first_purchase_at timestamptz,
  rewarded_at timestamptz,
  CHECK (referrer_customer_id <> referred_customer_id),
  CHECK (referrer_tenant_id <> referred_tenant_id)
);

CREATE TABLE public.coin_wallets (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned integer NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  lifetime_spent integer NOT NULL DEFAULT 0 CHECK (lifetime_spent >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.coin_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  referral_id uuid REFERENCES public.customer_referrals(id) ON DELETE SET NULL,
  referred_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('REFERRAL_REWARD','PURCHASE_REDEMPTION','ADMIN_ADJUSTMENT','REVERSAL')),
  delta integer NOT NULL CHECK (delta <> 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  reason text NOT NULL,
  admin_user_id uuid,
  reversal_of uuid REFERENCES public.coin_ledger(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX coin_referral_reward_once ON public.coin_ledger(referred_customer_id)
  WHERE entry_type = 'REFERRAL_REWARD';
CREATE UNIQUE INDEX coin_invoice_redemption_once ON public.coin_ledger(invoice_id)
  WHERE entry_type = 'PURCHASE_REDEMPTION';
CREATE UNIQUE INDEX coin_reversal_once ON public.coin_ledger(reversal_of)
  WHERE reversal_of IS NOT NULL AND entry_type = 'REVERSAL';
CREATE INDEX coin_ledger_customer_time_idx ON public.coin_ledger(customer_id, created_at DESC);

ALTER TABLE public.billing_invoices
  ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN coin_discount integer NOT NULL DEFAULT 0 CHECK (coin_discount >= 0),
  ADD COLUMN coin_redemption_restored_at timestamptz;

CREATE OR REPLACE FUNCTION public.ensure_referral_code(p_tenant_id uuid, p_customer_id uuid)
RETURNS public.referral_codes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result public.referral_codes;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id=p_customer_id AND tenant_id=p_tenant_id) THEN
    RAISE EXCEPTION 'CUSTOMER_TENANT_MISMATCH';
  END IF;
  INSERT INTO public.referral_codes(tenant_id, customer_id, code)
  VALUES (p_tenant_id, p_customer_id, encode(gen_random_bytes(24), 'hex'))
  ON CONFLICT (customer_id) DO NOTHING;
  SELECT * INTO result FROM public.referral_codes WHERE customer_id=p_customer_id;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.reverse_referral_reward(p_invoice_id uuid,p_reason text,p_admin_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reward public.coin_ledger; wallet public.coin_wallets;
BEGIN
  SELECT * INTO reward FROM public.coin_ledger WHERE invoice_id=p_invoice_id AND entry_type='REFERRAL_REWARD' FOR UPDATE;
  IF NOT FOUND OR EXISTS (SELECT 1 FROM public.coin_ledger WHERE reversal_of=reward.id) THEN RETURN false; END IF;
  SELECT * INTO wallet FROM public.coin_wallets WHERE customer_id=reward.customer_id FOR UPDATE;
  IF wallet.balance<100 THEN RAISE EXCEPTION 'ADMIN_REVIEW_REQUIRED_INSUFFICIENT_REWARD_BALANCE'; END IF;
  UPDATE public.coin_wallets SET balance=balance-100,lifetime_earned=GREATEST(0,lifetime_earned-100),updated_at=now()
  WHERE customer_id=reward.customer_id RETURNING * INTO wallet;
  INSERT INTO public.coin_ledger(tenant_id,customer_id,referral_id,referred_customer_id,invoice_id,entry_type,delta,balance_after,reason,admin_user_id,reversal_of)
  VALUES(reward.tenant_id,reward.customer_id,reward.referral_id,reward.referred_customer_id,p_invoice_id,'REVERSAL',-100,wallet.balance,p_reason,p_admin_id,reward.id);
  UPDATE public.customer_referrals SET status='PURCHASED',rewarded_at=NULL WHERE id=reward.referral_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.claim_referral_attribution(p_customer_id uuid, p_tenant_id uuid, p_telegram_user_id bigint)
RETURNS public.customer_referrals LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE click public.referral_clicks; result public.customer_referrals;
BEGIN
  SELECT * INTO result FROM public.customer_referrals WHERE referred_customer_id=p_customer_id;
  IF FOUND THEN RETURN result; END IF;
  SELECT rc.* INTO click FROM public.referral_clicks rc
  WHERE rc.telegram_user_id=p_telegram_user_id AND rc.referrer_customer_id<>p_customer_id
  ORDER BY rc.clicked_at ASC LIMIT 1;
  IF NOT FOUND OR click.referrer_tenant_id=p_tenant_id THEN RETURN NULL; END IF;
  INSERT INTO public.customer_referrals(referrer_customer_id,referrer_tenant_id,referred_customer_id,referred_tenant_id,referral_click_id)
  VALUES(click.referrer_customer_id,click.referrer_tenant_id,p_customer_id,p_tenant_id,click.id)
  ON CONFLICT (referred_customer_id) DO NOTHING;
  SELECT * INTO result FROM public.customer_referrals WHERE referred_customer_id=p_customer_id;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.award_first_purchase_referral(p_tenant_id uuid, p_invoice_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.billing_invoices; referral public.customer_referrals; wallet public.coin_wallets;
BEGIN
  SELECT * INTO inv FROM public.billing_invoices WHERE id=p_invoice_id AND tenant_id=p_tenant_id AND status='PAID';
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT cr.* INTO referral FROM public.customer_referrals cr
  WHERE cr.referred_tenant_id=p_tenant_id AND cr.first_purchase_invoice_id IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.billing_invoices WHERE tenant_id=p_tenant_id AND status='PAID' AND id<>p_invoice_id AND paid_at<=inv.paid_at) THEN
    RETURN false;
  END IF;
  INSERT INTO public.coin_wallets(customer_id,tenant_id) VALUES(referral.referrer_customer_id,referral.referrer_tenant_id)
  ON CONFLICT (customer_id) DO NOTHING;
  SELECT * INTO wallet FROM public.coin_wallets WHERE customer_id=referral.referrer_customer_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.coin_ledger WHERE referred_customer_id=referral.referred_customer_id AND entry_type='REFERRAL_REWARD') THEN RETURN false; END IF;
  UPDATE public.coin_wallets SET balance=balance+100,lifetime_earned=lifetime_earned+100,updated_at=now()
  WHERE customer_id=referral.referrer_customer_id RETURNING * INTO wallet;
  UPDATE public.customer_referrals SET status='REWARDED',first_purchase_invoice_id=p_invoice_id,first_purchase_at=inv.paid_at,rewarded_at=now()
  WHERE id=referral.id;
  INSERT INTO public.coin_ledger(tenant_id,customer_id,referral_id,referred_customer_id,invoice_id,entry_type,delta,balance_after,reason)
  VALUES(referral.referrer_tenant_id,referral.referrer_customer_id,referral.id,referral.referred_customer_id,p_invoice_id,'REFERRAL_REWARD',100,wallet.balance,'Direct referral first paid purchase');
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.reserve_coins_for_invoice(p_invoice_id uuid,p_customer_id uuid,p_coins integer)
RETURNS public.billing_invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv public.billing_invoices; wallet public.coin_wallets; max_coins integer; result public.billing_invoices;
BEGIN
  IF p_coins<=0 THEN RAISE EXCEPTION 'COINS_MUST_BE_POSITIVE'; END IF;
  SELECT * INTO inv FROM public.billing_invoices WHERE id=p_invoice_id AND customer_id=p_customer_id AND status='PENDING' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVOICE_NOT_ELIGIBLE'; END IF;
  IF inv.coin_discount>0 THEN RETURN inv; END IF;
  INSERT INTO public.coin_wallets(customer_id,tenant_id) VALUES(p_customer_id,inv.tenant_id) ON CONFLICT(customer_id) DO NOTHING;
  SELECT * INTO wallet FROM public.coin_wallets WHERE customer_id=p_customer_id FOR UPDATE;
  max_coins := LEAST(wallet.balance, floor(inv.base_price*100)::integer, p_coins);
  IF max_coins<=0 OR wallet.balance<p_coins THEN RAISE EXCEPTION 'INSUFFICIENT_COIN_BALANCE'; END IF;
  UPDATE public.coin_wallets SET balance=balance-max_coins,lifetime_spent=lifetime_spent+max_coins,updated_at=now()
  WHERE customer_id=p_customer_id RETURNING * INTO wallet;
  UPDATE public.billing_invoices SET coin_discount=max_coins,payable_amount=CASE WHEN max_coins>=floor(base_price*100)::integer THEN 0 ELSE round(base_price-(max_coins::numeric/100)+(amount_suffix::numeric/1000000),6) END,updated_at=now()
  WHERE id=p_invoice_id RETURNING * INTO result;
  UPDATE public.billing_transactions SET amount=result.payable_amount,invoice_payable_amount=result.payable_amount,updated_at=now() WHERE invoice_id=p_invoice_id;
  INSERT INTO public.coin_ledger(tenant_id,customer_id,invoice_id,entry_type,delta,balance_after,reason)
  VALUES(inv.tenant_id,p_customer_id,p_invoice_id,'PURCHASE_REDEMPTION',-max_coins,wallet.balance,'Coins reserved for platform purchase');
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.adjust_coin_wallet(p_customer_id uuid,p_amount integer,p_reason text,p_admin_id uuid)
RETURNS public.coin_wallets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE wallet public.coin_wallets; tenant uuid;
BEGIN
  IF p_amount=0 OR nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'AMOUNT_AND_REASON_REQUIRED'; END IF;
  SELECT tenant_id INTO tenant FROM public.customers WHERE id=p_customer_id;
  INSERT INTO public.coin_wallets(customer_id,tenant_id) VALUES(p_customer_id,tenant) ON CONFLICT(customer_id) DO NOTHING;
  SELECT * INTO wallet FROM public.coin_wallets WHERE customer_id=p_customer_id FOR UPDATE;
  IF wallet.balance+p_amount<0 THEN RAISE EXCEPTION 'INSUFFICIENT_COIN_BALANCE'; END IF;
  UPDATE public.coin_wallets SET balance=balance+p_amount,lifetime_earned=lifetime_earned+GREATEST(p_amount,0),lifetime_spent=lifetime_spent+GREATEST(-p_amount,0),updated_at=now()
  WHERE customer_id=p_customer_id RETURNING * INTO wallet;
  INSERT INTO public.coin_ledger(tenant_id,customer_id,entry_type,delta,balance_after,reason,admin_user_id)
  VALUES(wallet.tenant_id,p_customer_id,'ADMIN_ADJUSTMENT',p_amount,wallet.balance,p_reason,p_admin_id);
  RETURN wallet;
END $$;

CREATE OR REPLACE FUNCTION public.restore_invoice_coins()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE debit public.coin_ledger; wallet public.coin_wallets;
BEGIN
  IF NEW.status IN ('CANCELLED','EXPIRED') AND OLD.status<>NEW.status AND NEW.coin_discount>0 AND NEW.coin_redemption_restored_at IS NULL THEN
    SELECT * INTO debit FROM public.coin_ledger WHERE invoice_id=NEW.id AND entry_type='PURCHASE_REDEMPTION';
    IF FOUND AND NOT EXISTS (SELECT 1 FROM public.coin_ledger WHERE reversal_of=debit.id) THEN
      SELECT * INTO wallet FROM public.coin_wallets WHERE customer_id=debit.customer_id FOR UPDATE;
      UPDATE public.coin_wallets SET balance=balance+NEW.coin_discount,lifetime_spent=GREATEST(0,lifetime_spent-NEW.coin_discount),updated_at=now()
      WHERE customer_id=debit.customer_id RETURNING * INTO wallet;
      INSERT INTO public.coin_ledger(tenant_id,customer_id,invoice_id,entry_type,delta,balance_after,reason,reversal_of)
      VALUES(debit.tenant_id,debit.customer_id,NEW.id,'REVERSAL',NEW.coin_discount,wallet.balance,'Cancelled or expired invoice coin restoration',debit.id);
      NEW.coin_redemption_restored_at=now();
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS billing_invoice_coin_restore ON public.billing_invoices;
CREATE TRIGGER billing_invoice_coin_restore BEFORE UPDATE OF status ON public.billing_invoices
FOR EACH ROW EXECUTE FUNCTION public.restore_invoice_coins();

ALTER TABLE public.growth_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_membership_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_content_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.growth_collection_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_ledger ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.growth_destinations,public.growth_snapshots,public.growth_membership_events,public.growth_content_metrics,public.growth_collection_checkpoints,public.referral_codes,public.referral_clicks,public.customer_referrals,public.coin_wallets,public.coin_ledger TO service_role;
REVOKE ALL ON FUNCTION public.ensure_referral_code(uuid,uuid),public.claim_referral_attribution(uuid,uuid,bigint),public.award_first_purchase_referral(uuid,uuid),public.reserve_coins_for_invoice(uuid,uuid,integer),public.adjust_coin_wallet(uuid,integer,text,uuid),public.reverse_referral_reward(uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_referral_code(uuid,uuid),public.claim_referral_attribution(uuid,uuid,bigint),public.award_first_purchase_referral(uuid,uuid),public.reserve_coins_for_invoice(uuid,uuid,integer),public.adjust_coin_wallet(uuid,integer,text,uuid),public.reverse_referral_reward(uuid,text,uuid) TO service_role;
