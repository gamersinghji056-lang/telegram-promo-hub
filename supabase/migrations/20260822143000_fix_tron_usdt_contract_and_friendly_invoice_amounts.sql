-- Fix the TRON mainnet USDT contract used by production invoices/monitoring.
-- The previous value was not the official TRC20 USDT contract and caused real
-- transfers to be hidden by the TronGrid contract filter.
UPDATE public.system_settings
SET value = jsonb_set(
      COALESCE(value, '{}'::jsonb),
      '{usdt_contract}',
      to_jsonb('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'::text),
      true
    ),
    updated_at = now()
WHERE key = 'payments';

UPDATE public.billing_invoices
SET token_contract = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    updated_at = now()
WHERE token_contract = 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj'
  AND status IN ('PENDING', 'PAYMENT_DETECTED', 'CONFIRMING', 'EXPIRED')
  AND paid_at IS NULL;

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
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text, 20260822));
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

  -- Prefer human-friendly unique amounts: 20.1, 20.2 ... 20.9.
  -- Fall back to two decimals when the one-decimal active invoice pool is full.
  FOR suffix IN 1..9 LOOP
    payable := round(p_base_price::numeric + (suffix::numeric / 10), 6);
    BEGIN
      INSERT INTO public.billing_invoices (
        tenant_id, product_type, product_code, plan_id, base_price, payable_amount,
        amount_suffix, receiving_address, network, token_contract, expires_at
      )
      VALUES (
        p_tenant_id, p_product_type, upper(p_product_code), p_plan_id, round(p_base_price::numeric, 6), payable,
        suffix * 100000, p_receiving_address, upper(p_network), p_token_contract, now() + interval '10 minutes'
      )
      RETURNING * INTO created;
      RETURN created;
    EXCEPTION WHEN unique_violation THEN
      -- Retry amount collision among active invoices.
    END;
  END LOOP;

  FOR suffix IN 1..99 LOOP
    payable := round(p_base_price::numeric + (suffix::numeric / 100), 6);
    BEGIN
      INSERT INTO public.billing_invoices (
        tenant_id, product_type, product_code, plan_id, base_price, payable_amount,
        amount_suffix, receiving_address, network, token_contract, expires_at
      )
      VALUES (
        p_tenant_id, p_product_type, upper(p_product_code), p_plan_id, round(p_base_price::numeric, 6), payable,
        suffix * 10000, p_receiving_address, upper(p_network), p_token_contract, now() + interval '10 minutes'
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

GRANT EXECUTE ON FUNCTION public.create_usdt_billing_invoice(uuid, public.billing_product_type, text, uuid, numeric, text, text, text, boolean) TO service_role;
