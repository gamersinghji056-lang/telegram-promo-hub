-- Real TRON USDT invoice billing, Premium Emoji add-on entitlement, and UI preferences.
-- Additive only: preserves existing plans, subscriptions, billing_transactions and history.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_invoice_status') THEN
    CREATE TYPE public.billing_invoice_status AS ENUM (
      'PENDING',
      'PAYMENT_DETECTED',
      'CONFIRMING',
      'PAID',
      'EXPIRED',
      'CANCELLED',
      'UNDERPAID',
      'OVERPAID',
      'LATE_PAYMENT',
      'REVIEW_REQUIRED'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_product_type') THEN
    CREATE TYPE public.billing_product_type AS ENUM ('PLAN', 'ADDON');
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS public.billing_invoice_amount_sequence
  MINVALUE 1
  MAXVALUE 999999
  CYCLE;

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE DEFAULT ('INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_type public.billing_product_type NOT NULL,
  product_code text NOT NULL,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  base_price numeric(18, 6) NOT NULL CHECK (base_price >= 0),
  payable_amount numeric(18, 6) NOT NULL CHECK (payable_amount >= 0),
  amount_suffix integer NOT NULL CHECK (amount_suffix BETWEEN 0 AND 999999),
  currency text NOT NULL DEFAULT 'USDT',
  network text NOT NULL DEFAULT 'TRON',
  token_standard text NOT NULL DEFAULT 'TRC20',
  token_contract text NOT NULL,
  receiving_address text NOT NULL,
  status public.billing_invoice_status NOT NULL DEFAULT 'PENDING',
  expires_at timestamptz NOT NULL,
  cancelled_at timestamptz,
  cancellation_reason text,
  detected_at timestamptz,
  confirmed_at timestamptz,
  paid_at timestamptz,
  tx_hash text,
  from_address text,
  to_address text,
  raw_token_amount text,
  normalized_amount numeric(18, 6),
  block_number bigint,
  transaction_timestamp timestamptz,
  blockchain_status text,
  review_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_transactions
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_type text,
  ADD COLUMN IF NOT EXISTS product_code text,
  ADD COLUMN IF NOT EXISTS base_price numeric(18, 6),
  ADD COLUMN IF NOT EXISTS invoice_payable_amount numeric(18, 6),
  ADD COLUMN IF NOT EXISTS detected_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS blockchain_status text,
  ADD COLUMN IF NOT EXISTS review_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS billing_invoices_tx_hash_unique_idx
  ON public.billing_invoices (lower(tx_hash))
  WHERE tx_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS billing_transactions_tx_hash_unique_idx
  ON public.billing_transactions (lower(tx_hash))
  WHERE tx_hash IS NOT NULL AND tx_hash <> '';

CREATE UNIQUE INDEX IF NOT EXISTS billing_invoices_active_intent_idx
  ON public.billing_invoices (tenant_id, product_type, product_code)
  WHERE status IN ('PENDING', 'PAYMENT_DETECTED', 'CONFIRMING');

CREATE UNIQUE INDEX IF NOT EXISTS billing_invoices_active_amount_idx
  ON public.billing_invoices (network, token_contract, receiving_address, payable_amount)
  WHERE status IN ('PENDING', 'PAYMENT_DETECTED', 'CONFIRMING');

CREATE INDEX IF NOT EXISTS billing_invoices_tenant_created_idx
  ON public.billing_invoices (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS billing_invoices_status_expires_idx
  ON public.billing_invoices (status, expires_at);

CREATE TABLE IF NOT EXISTS public.blockchain_payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  network text NOT NULL,
  token_contract text NOT NULL,
  tx_hash text NOT NULL,
  from_address text,
  to_address text NOT NULL,
  raw_token_amount text NOT NULL,
  normalized_amount numeric(18, 6) NOT NULL,
  block_number bigint,
  transaction_timestamp timestamptz,
  confirmation_status text NOT NULL DEFAULT 'CONFIRMED',
  classification text NOT NULL,
  raw_event jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (network, tx_hash)
);

CREATE INDEX IF NOT EXISTS blockchain_payment_events_invoice_idx
  ON public.blockchain_payment_events (invoice_id);

CREATE TABLE IF NOT EXISTS public.blockchain_scan_checkpoints (
  id text PRIMARY KEY,
  network text NOT NULL,
  token_contract text NOT NULL,
  receiving_address text NOT NULL,
  last_scanned_at timestamptz,
  last_processed_block bigint,
  last_success_at timestamptz,
  last_error text,
  status text NOT NULL DEFAULT 'UNKNOWN',
  cursor_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_addon_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  addon_code text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'REVOKED')),
  source text NOT NULL DEFAULT 'PAID',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  no_expiry boolean NOT NULL DEFAULT false,
  granted_by uuid,
  grant_reason text,
  revoked_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, addon_code)
);

CREATE INDEX IF NOT EXISTS tenant_addon_entitlements_tenant_idx
  ON public.tenant_addon_entitlements (tenant_id, addon_code);

CREATE TABLE IF NOT EXISTS public.customer_preferences (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'zh-CN', 'ru', 'fa')),
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  notifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_preferences (
  admin_user_id uuid PRIMARY KEY,
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'zh-CN', 'ru', 'fa')),
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS message_entities jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.message_templates
  ADD COLUMN IF NOT EXISTS message_entities jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.expire_stale_billing_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  changed integer := 0;
BEGIN
  UPDATE public.billing_invoices
  SET status = 'EXPIRED',
      updated_at = now()
  WHERE status = 'PENDING'
    AND expires_at <= now();
  GET DIAGNOSTICS changed = ROW_COUNT;

  UPDATE public.billing_transactions bt
  SET status = 'EXPIRED',
      updated_at = now()
  FROM public.billing_invoices bi
  WHERE bt.invoice_id = bi.id
    AND bi.status = 'EXPIRED'
    AND bt.status = 'PENDING';

  RETURN changed;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_usdt_billing_invoice(
  p_tenant_id uuid,
  p_product_type public.billing_product_type,
  p_product_code text,
  p_plan_id uuid,
  p_base_price numeric,
  p_receiving_address text,
  p_network text,
  p_token_contract text,
  p_replace boolean DEFAULT false
)
RETURNS public.billing_invoices
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing public.billing_invoices;
  other_active public.billing_invoices;
  suffix integer;
  payable numeric(18, 6);
  created public.billing_invoices;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 20260821));
  PERFORM public.expire_stale_billing_invoices();

  SELECT * INTO existing
  FROM public.billing_invoices
  WHERE tenant_id = p_tenant_id
    AND product_type = p_product_type
    AND product_code = upper(p_product_code)
    AND status IN ('PENDING', 'PAYMENT_DETECTED', 'CONFIRMING')
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;
  IF FOUND THEN
    RETURN existing;
  END IF;

  SELECT * INTO other_active
  FROM public.billing_invoices
  WHERE tenant_id = p_tenant_id
    AND status IN ('PENDING', 'PAYMENT_DETECTED', 'CONFIRMING')
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND AND NOT p_replace THEN
    RAISE EXCEPTION 'ACTIVE_INVOICE_EXISTS:%:%:%',
      other_active.id, other_active.product_code, other_active.product_type;
  END IF;

  IF FOUND AND p_replace THEN
    UPDATE public.billing_invoices
    SET status = 'CANCELLED',
        cancelled_at = now(),
        cancellation_reason = 'Customer replaced invoice',
        updated_at = now()
    WHERE id = other_active.id;
    UPDATE public.billing_transactions
    SET status = 'CANCELLED',
        updated_at = now()
    WHERE invoice_id = other_active.id
      AND status = 'PENDING';
  END IF;

  FOR i IN 1..50 LOOP
    suffix := nextval('public.billing_invoice_amount_sequence')::integer;
    payable := round(p_base_price::numeric + (suffix::numeric / 1000000), 6);
    BEGIN
      INSERT INTO public.billing_invoices (
        tenant_id, product_type, product_code, plan_id, base_price, payable_amount,
        amount_suffix, receiving_address, network, token_contract, expires_at
      )
      VALUES (
        p_tenant_id, p_product_type, upper(p_product_code), p_plan_id, round(p_base_price::numeric, 6), payable,
        suffix, p_receiving_address, upper(p_network), p_token_contract, now() + interval '10 minutes'
      )
      RETURNING * INTO created;
      RETURN created;
    EXCEPTION WHEN unique_violation THEN
      -- Retry amount collision among active invoices.
    END;
  END LOOP;

  RAISE EXCEPTION 'Could not allocate a unique invoice amount. Try again.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_billing_invoices() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_usdt_billing_invoice(uuid, public.billing_product_type, text, uuid, numeric, text, text, text, boolean) TO service_role;

-- Hide legacy duplicate pending requests created by the pre-invoice flow without deleting history.
UPDATE public.billing_transactions
SET status = 'EXPIRED',
    updated_at = now()
WHERE status = 'PENDING'
  AND invoice_id IS NULL
  AND paid_at IS NULL
  AND created_at < now() - interval '10 minutes';

INSERT INTO public.system_settings (key, value)
VALUES
  ('addons', '{"premium_emoji":{"enabled":true,"price_usd":20,"duration_days":30}}'::jsonb)
ON CONFLICT (key) DO NOTHING;

UPDATE public.system_settings
SET value = value || '{"invoice_expiry_minutes":10,"tron_network":"mainnet"}'::jsonb,
    updated_at = now()
WHERE key = 'payments';

GRANT ALL ON public.billing_invoices TO service_role;
GRANT ALL ON public.blockchain_payment_events TO service_role;
GRANT ALL ON public.blockchain_scan_checkpoints TO service_role;
GRANT ALL ON public.tenant_addon_entitlements TO service_role;
GRANT ALL ON public.customer_preferences TO service_role;
GRANT ALL ON public.admin_preferences TO service_role;

ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blockchain_payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blockchain_scan_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_addon_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_preferences ENABLE ROW LEVEL SECURITY;
