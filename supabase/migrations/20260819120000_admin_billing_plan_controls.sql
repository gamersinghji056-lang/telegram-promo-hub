-- Admin billing, public/private plans, entitlement overrides, and monthly usage ledger.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_active_campaigns integer,
  ADD COLUMN IF NOT EXISTS max_saved_groups integer,
  ADD COLUMN IF NOT EXISTS monthly_groups_found_limit integer,
  ADD COLUMN IF NOT EXISTS monthly_audience_found_limit integer,
  ADD COLUMN IF NOT EXISTS monthly_dm_message_limit integer,
  ADD COLUMN IF NOT EXISTS max_categories integer,
  ADD COLUMN IF NOT EXISTS monthly_writable_check_limit integer,
  ADD COLUMN IF NOT EXISTS monthly_sendable_check_limit integer,
  ADD COLUMN IF NOT EXISTS analytics_level text NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS scheduling_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS session_health_level text NOT NULL DEFAULT 'basic';

ALTER TABLE public.plans
  ALTER COLUMN max_groups DROP NOT NULL,
  ALTER COLUMN max_campaigns DROP NOT NULL,
  ALTER COLUMN max_audience DROP NOT NULL,
  ALTER COLUMN monthly_message_limit DROP NOT NULL;

UPDATE public.plans
SET
  max_active_campaigns = COALESCE(max_active_campaigns, max_campaigns),
  max_saved_groups = COALESCE(max_saved_groups, max_groups),
  monthly_audience_found_limit = COALESCE(monthly_audience_found_limit, max_audience),
  monthly_dm_message_limit = COALESCE(monthly_dm_message_limit, monthly_message_limit),
  max_categories = COALESCE(max_categories, 10),
  monthly_groups_found_limit = COALESCE(monthly_groups_found_limit, max_groups),
  monthly_writable_check_limit = COALESCE(monthly_writable_check_limit, max_groups),
  monthly_sendable_check_limit = COALESCE(monthly_sendable_check_limit, max_groups),
  description = COALESCE(description, name || ' plan')
WHERE true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_non_negative_quota_check') THEN
    ALTER TABLE public.plans
      ADD CONSTRAINT plans_non_negative_quota_check CHECK (
        price_usd >= 0 AND duration_days >= 0 AND sort_order >= 0
        AND max_connections >= 0
        AND (max_active_campaigns IS NULL OR max_active_campaigns >= 0)
        AND (max_saved_groups IS NULL OR max_saved_groups >= 0)
        AND (monthly_groups_found_limit IS NULL OR monthly_groups_found_limit >= 0)
        AND (monthly_audience_found_limit IS NULL OR monthly_audience_found_limit >= 0)
        AND (monthly_message_limit IS NULL OR monthly_message_limit >= 0)
        AND (monthly_dm_message_limit IS NULL OR monthly_dm_message_limit >= 0)
        AND (max_categories IS NULL OR max_categories >= 0)
        AND (monthly_writable_check_limit IS NULL OR monthly_writable_check_limit >= 0)
        AND (monthly_sendable_check_limit IS NULL OR monthly_sendable_check_limit >= 0)
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_feature_flags_check') THEN
    ALTER TABLE public.plans
      ADD CONSTRAINT plans_feature_flags_check CHECK (
        analytics_level IN ('basic', 'full')
        AND session_health_level IN ('disabled', 'basic', 'full')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plans_hard_connection_cap_check') THEN
    ALTER TABLE public.plans
      ADD CONSTRAINT plans_hard_connection_cap_check CHECK (max_connections <= 20);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.monthly_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  groups_found integer NOT NULL DEFAULT 0,
  audience_found integer NOT NULL DEFAULT 0,
  promotion_messages integer NOT NULL DEFAULT 0,
  dm_messages integer NOT NULL DEFAULT 0,
  writable_checks integer NOT NULL DEFAULT 0,
  sendable_checks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_start),
  CHECK (
    groups_found >= 0
    AND audience_found >= 0
    AND promotion_messages >= 0
    AND dm_messages >= 0
    AND writable_checks >= 0
    AND sendable_checks >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_monthly_usage_tenant_period
  ON public.monthly_usage(tenant_id, period_start DESC);

CREATE OR REPLACE FUNCTION public.increment_monthly_usage(
  p_tenant_id uuid,
  p_period_start date,
  p_groups_found integer DEFAULT 0,
  p_audience_found integer DEFAULT 0,
  p_promotion_messages integer DEFAULT 0,
  p_dm_messages integer DEFAULT 0,
  p_writable_checks integer DEFAULT 0,
  p_sendable_checks integer DEFAULT 0
)
RETURNS public.monthly_usage
LANGUAGE plpgsql
AS $$
DECLARE
  updated_row public.monthly_usage;
BEGIN
  INSERT INTO public.monthly_usage (
    tenant_id,
    period_start,
    groups_found,
    audience_found,
    promotion_messages,
    dm_messages,
    writable_checks,
    sendable_checks
  )
  VALUES (
    p_tenant_id,
    p_period_start,
    GREATEST(COALESCE(p_groups_found, 0), 0),
    GREATEST(COALESCE(p_audience_found, 0), 0),
    GREATEST(COALESCE(p_promotion_messages, 0), 0),
    GREATEST(COALESCE(p_dm_messages, 0), 0),
    GREATEST(COALESCE(p_writable_checks, 0), 0),
    GREATEST(COALESCE(p_sendable_checks, 0), 0)
  )
  ON CONFLICT (tenant_id, period_start) DO UPDATE SET
    groups_found = public.monthly_usage.groups_found + EXCLUDED.groups_found,
    audience_found = public.monthly_usage.audience_found + EXCLUDED.audience_found,
    promotion_messages = public.monthly_usage.promotion_messages + EXCLUDED.promotion_messages,
    dm_messages = public.monthly_usage.dm_messages + EXCLUDED.dm_messages,
    writable_checks = public.monthly_usage.writable_checks + EXCLUDED.writable_checks,
    sendable_checks = public.monthly_usage.sendable_checks + EXCLUDED.sendable_checks,
    updated_at = now()
  RETURNING * INTO updated_row;

  RETURN updated_row;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_monthly_usage(uuid, date, integer, integer, integer, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_monthly_usage(uuid, date, integer, integer, integer, integer, integer, integer) TO service_role;

CREATE TABLE IF NOT EXISTS public.tenant_entitlement_overrides (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  override_type text NOT NULL DEFAULT 'CUSTOM',
  max_connections integer,
  max_active_campaigns integer,
  max_saved_groups integer,
  monthly_groups_found_limit integer,
  monthly_audience_found_limit integer,
  monthly_message_limit integer,
  monthly_dm_message_limit integer,
  max_categories integer,
  monthly_writable_check_limit integer,
  monthly_sendable_check_limit integer,
  analytics_level text,
  scheduling_enabled boolean,
  session_health_level text,
  expires_at timestamptz,
  granted_by uuid,
  grant_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (override_type IN ('CUSTOM', 'UNLIMITED')),
  CHECK (max_connections IS NULL OR (max_connections >= 0 AND max_connections <= 20))
);

CREATE INDEX IF NOT EXISTS idx_entitlement_overrides_expiry
  ON public.tenant_entitlement_overrides(expires_at);

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS granted_by uuid,
  ADD COLUMN IF NOT EXISTS grant_reason text,
  ADD COLUMN IF NOT EXISTS no_expiry boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.billing_transactions
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link text;

GRANT ALL ON public.monthly_usage TO service_role;
GRANT ALL ON public.tenant_entitlement_overrides TO service_role;
ALTER TABLE public.monthly_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_entitlement_overrides ENABLE ROW LEVEL SECURITY;

INSERT INTO public.plans (
  code, name, description, price_usd, duration_days, max_connections, max_groups, max_campaigns,
  max_audience, monthly_message_limit, is_active, sort_order, is_public, is_custom,
  max_active_campaigns, max_saved_groups, monthly_groups_found_limit, monthly_audience_found_limit,
  monthly_dm_message_limit, max_categories, monthly_writable_check_limit, monthly_sendable_check_limit,
  analytics_level, scheduling_enabled, session_health_level, updated_at
) VALUES
  ('TEST','TEST','Product testing with restricted quotas.',0,30,1,20,1,50,50,true,1,true,false,1,20,20,50,20,1,20,10,'basic',false,'basic',now()),
  ('PLUS','PLUS','Small team growth plan.',20,30,5,2000,5,10000,20000,true,2,true,false,5,2000,5000,10000,5000,25,5000,2500,'full',true,'full',now()),
  ('PRO','PRO','Higher volume promotion operations.',30,30,10,10000,15,50000,100000,true,3,true,false,15,10000,25000,50000,25000,100,25000,15000,'full',true,'full',now()),
  ('ENTERPRISE','ENTERPRISE','Unlimited plan quotas with Telegram session cap.',50,30,20,NULL,NULL,NULL,NULL,true,4,true,false,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'full',true,'full',now())
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_usd = EXCLUDED.price_usd,
  duration_days = EXCLUDED.duration_days,
  max_connections = EXCLUDED.max_connections,
  max_groups = EXCLUDED.max_groups,
  max_campaigns = EXCLUDED.max_campaigns,
  max_audience = EXCLUDED.max_audience,
  monthly_message_limit = EXCLUDED.monthly_message_limit,
  is_active = true,
  is_public = true,
  is_custom = false,
  sort_order = EXCLUDED.sort_order,
  max_active_campaigns = EXCLUDED.max_active_campaigns,
  max_saved_groups = EXCLUDED.max_saved_groups,
  monthly_groups_found_limit = EXCLUDED.monthly_groups_found_limit,
  monthly_audience_found_limit = EXCLUDED.monthly_audience_found_limit,
  monthly_dm_message_limit = EXCLUDED.monthly_dm_message_limit,
  max_categories = EXCLUDED.max_categories,
  monthly_writable_check_limit = EXCLUDED.monthly_writable_check_limit,
  monthly_sendable_check_limit = EXCLUDED.monthly_sendable_check_limit,
  analytics_level = EXCLUDED.analytics_level,
  scheduling_enabled = EXCLUDED.scheduling_enabled,
  session_health_level = EXCLUDED.session_health_level,
  updated_at = now();

UPDATE public.system_settings
SET value = jsonb_set(value, '{default_plan_code}', '"TEST"', true),
    updated_at = now()
WHERE key = 'registration'
  AND COALESCE(value->>'default_plan_code', '') IN ('', 'FREE');
