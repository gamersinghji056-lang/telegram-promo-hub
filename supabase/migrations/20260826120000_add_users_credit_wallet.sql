-- Add Users credits: independent top-up wallet and idempotent success-only debits.

CREATE TABLE IF NOT EXISTS public.tenant_add_users_credits (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  purchased_balance integer NOT NULL DEFAULT 0 CHECK (purchased_balance >= 0),
  free_trial_used integer NOT NULL DEFAULT 0 CHECK (free_trial_used BETWEEN 0 AND 5),
  successful_additions integer NOT NULL DEFAULT 0 CHECK (successful_additions >= 0),
  credits_consumed integer NOT NULL DEFAULT 0 CHECK (credits_consumed >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.add_users_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  job_id uuid REFERENCES public.add_users_jobs(id) ON DELETE SET NULL,
  result_id uuid REFERENCES public.add_users_job_results(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  delta integer NOT NULL,
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  free_trial_after integer NOT NULL CHECK (free_trial_after BETWEEN 0 AND 5),
  entry_type text NOT NULL CHECK (entry_type IN ('FREE_SUCCESS', 'SUCCESS_DEBIT', 'PURCHASE_CREDIT', 'ADMIN_GRANT', 'ADMIN_ADJUST')),
  reason text,
  created_by uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS add_users_credit_ledger_result_unique
  ON public.add_users_credit_ledger(result_id)
  WHERE result_id IS NOT NULL AND entry_type IN ('FREE_SUCCESS', 'SUCCESS_DEBIT');

CREATE UNIQUE INDEX IF NOT EXISTS add_users_credit_ledger_invoice_unique
  ON public.add_users_credit_ledger(invoice_id)
  WHERE invoice_id IS NOT NULL AND entry_type = 'PURCHASE_CREDIT';

CREATE INDEX IF NOT EXISTS add_users_credit_ledger_tenant_created_idx
  ON public.add_users_credit_ledger(tenant_id, created_at DESC);

ALTER TABLE public.tenant_add_users_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.add_users_credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_add_users_credits_service_role_all ON public.tenant_add_users_credits;
CREATE POLICY tenant_add_users_credits_service_role_all
  ON public.tenant_add_users_credits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS add_users_credit_ledger_service_role_all ON public.add_users_credit_ledger;
CREATE POLICY add_users_credit_ledger_service_role_all
  ON public.add_users_credit_ledger
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.add_users_credit_capacity(p_tenant_id uuid)
RETURNS TABLE (
  purchased_balance integer,
  free_trial_used integer,
  free_trial_remaining integer,
  available_capacity integer,
  successful_additions integer,
  credits_consumed integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wallet public.tenant_add_users_credits;
BEGIN
  INSERT INTO public.tenant_add_users_credits (tenant_id)
  VALUES (p_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;

  SELECT * INTO wallet
  FROM public.tenant_add_users_credits
  WHERE tenant_id = p_tenant_id;

  RETURN QUERY SELECT
    wallet.purchased_balance,
    wallet.free_trial_used,
    GREATEST(0, 5 - wallet.free_trial_used),
    wallet.purchased_balance + GREATEST(0, 5 - wallet.free_trial_used),
    wallet.successful_additions,
    wallet.credits_consumed;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_add_users_credit(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_job_id uuid,
  p_result_id uuid
)
RETURNS TABLE (
  ok boolean,
  reason text,
  purchased_balance integer,
  free_trial_used integer,
  free_trial_remaining integer,
  available_capacity integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wallet public.tenant_add_users_credits;
  existing public.add_users_credit_ledger;
  entry_type text;
  delta integer := 0;
BEGIN
  INSERT INTO public.tenant_add_users_credits (tenant_id)
  VALUES (p_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;

  SELECT * INTO existing
  FROM public.add_users_credit_ledger
  WHERE result_id = p_result_id
    AND entry_type IN ('FREE_SUCCESS', 'SUCCESS_DEBIT');
  IF existing.id IS NOT NULL THEN
    SELECT * INTO wallet FROM public.tenant_add_users_credits WHERE tenant_id = p_tenant_id;
    RETURN QUERY SELECT true, 'Already counted', wallet.purchased_balance, wallet.free_trial_used, GREATEST(0, 5 - wallet.free_trial_used), wallet.purchased_balance + GREATEST(0, 5 - wallet.free_trial_used);
    RETURN;
  END IF;

  SELECT * INTO wallet
  FROM public.tenant_add_users_credits
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF wallet.free_trial_used < 5 THEN
    entry_type := 'FREE_SUCCESS';
    UPDATE public.tenant_add_users_credits
    SET free_trial_used = free_trial_used + 1,
        successful_additions = successful_additions + 1,
        updated_at = now()
    WHERE tenant_id = p_tenant_id
    RETURNING * INTO wallet;
  ELSIF wallet.purchased_balance > 0 THEN
    entry_type := 'SUCCESS_DEBIT';
    delta := -1;
    UPDATE public.tenant_add_users_credits
    SET purchased_balance = purchased_balance - 1,
        successful_additions = successful_additions + 1,
        credits_consumed = credits_consumed + 1,
        updated_at = now()
    WHERE tenant_id = p_tenant_id
    RETURNING * INTO wallet;
  ELSE
    RETURN QUERY SELECT false, 'Add Users credits exhausted', wallet.purchased_balance, wallet.free_trial_used, 0, 0;
    RETURN;
  END IF;

  INSERT INTO public.add_users_credit_ledger (
    tenant_id, customer_id, job_id, result_id, delta, balance_after,
    free_trial_after, entry_type, reason
  )
  VALUES (
    p_tenant_id, p_customer_id, p_job_id, p_result_id, delta, wallet.purchased_balance,
    wallet.free_trial_used, entry_type, CASE WHEN entry_type = 'FREE_SUCCESS' THEN 'Free trial successful add' ELSE 'Successful Add Users credit debit' END
  )
  ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT true, null::text, wallet.purchased_balance, wallet.free_trial_used, GREATEST(0, 5 - wallet.free_trial_used), wallet.purchased_balance + GREATEST(0, 5 - wallet.free_trial_used);
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_add_users_credits(
  p_tenant_id uuid,
  p_amount integer,
  p_reason text,
  p_admin_id uuid DEFAULT null,
  p_invoice_id uuid DEFAULT null
)
RETURNS public.tenant_add_users_credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  wallet public.tenant_add_users_credits;
  entry text := CASE WHEN p_invoice_id IS NOT NULL THEN 'PURCHASE_CREDIT' ELSE 'ADMIN_GRANT' END;
BEGIN
  IF p_amount = 0 THEN
    RAISE EXCEPTION 'Credit amount must not be zero.';
  END IF;

  INSERT INTO public.tenant_add_users_credits (tenant_id)
  VALUES (p_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;

  IF p_invoice_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.add_users_credit_ledger
    WHERE invoice_id = p_invoice_id AND entry_type = 'PURCHASE_CREDIT'
  ) THEN
    SELECT * INTO wallet FROM public.tenant_add_users_credits WHERE tenant_id = p_tenant_id;
    RETURN wallet;
  END IF;

  SELECT * INTO wallet
  FROM public.tenant_add_users_credits
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF wallet.purchased_balance + p_amount < 0 THEN
    RAISE EXCEPTION 'Add Users credit balance cannot go negative.';
  END IF;

  UPDATE public.tenant_add_users_credits
  SET purchased_balance = purchased_balance + p_amount,
      updated_at = now()
  WHERE tenant_id = p_tenant_id
  RETURNING * INTO wallet;

  INSERT INTO public.add_users_credit_ledger (
    tenant_id, invoice_id, delta, balance_after, free_trial_after,
    entry_type, reason, created_by
  )
  VALUES (
    p_tenant_id, p_invoice_id, p_amount, wallet.purchased_balance, wallet.free_trial_used,
    entry, p_reason, p_admin_id
  )
  ON CONFLICT DO NOTHING;

  RETURN wallet;
END;
$$;

GRANT ALL ON public.tenant_add_users_credits TO service_role;
GRANT ALL ON public.add_users_credit_ledger TO service_role;
GRANT EXECUTE ON FUNCTION public.add_users_credit_capacity(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_add_users_credit(uuid, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_add_users_credits(uuid, integer, text, uuid, uuid) TO service_role;
