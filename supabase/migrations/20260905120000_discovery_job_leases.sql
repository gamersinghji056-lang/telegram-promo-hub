-- Durable, fair discovery worker leases.
-- Apply manually on the production Supabase project golstjqknldynotlglft.

ALTER TABLE public.group_discovery_states
  ADD COLUMN IF NOT EXISTS lease_owner text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;

ALTER TABLE public.audience_discovery_states
  ADD COLUMN IF NOT EXISTS next_search_at timestamptz,
  ADD COLUMN IF NOT EXISTS lease_owner text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_group_discovery_states_worker_due
  ON public.group_discovery_states(status, next_search_at, lease_expires_at, updated_at);

CREATE INDEX IF NOT EXISTS idx_audience_discovery_states_worker_due
  ON public.audience_discovery_states(status, next_search_at, lease_expires_at, updated_at);

CREATE OR REPLACE FUNCTION public.claim_group_discovery_jobs(
  p_worker_id text,
  p_limit integer DEFAULT 5,
  p_lease_seconds integer DEFAULT 120
)
RETURNS SETOF public.group_discovery_states
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT tenant_id
    FROM public.group_discovery_states
    WHERE status = 'RUNNING'
      AND (next_search_at IS NULL OR next_search_at <= now())
      AND (lease_expires_at IS NULL OR lease_expires_at <= now())
    ORDER BY
      COALESCE(last_search_at, 'epoch'::timestamptz) ASC,
      updated_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 5), 20))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.group_discovery_states s
  SET lease_owner = p_worker_id,
      lease_expires_at = now() + make_interval(secs => GREATEST(30, LEAST(COALESCE(p_lease_seconds, 120), 900))),
      updated_at = now()
  FROM candidates c
  WHERE s.tenant_id = c.tenant_id
  RETURNING s.*;
$$;

CREATE OR REPLACE FUNCTION public.claim_audience_discovery_jobs(
  p_worker_id text,
  p_limit integer DEFAULT 2,
  p_lease_seconds integer DEFAULT 180
)
RETURNS SETOF public.audience_discovery_states
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT tenant_id
    FROM public.audience_discovery_states
    WHERE status = 'RUNNING'
      AND (next_search_at IS NULL OR next_search_at <= now())
      AND (lease_expires_at IS NULL OR lease_expires_at <= now())
    ORDER BY updated_at ASC
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 2), 10))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.audience_discovery_states s
  SET lease_owner = p_worker_id,
      lease_expires_at = now() + make_interval(secs => GREATEST(30, LEAST(COALESCE(p_lease_seconds, 180), 900))),
      updated_at = now()
  FROM candidates c
  WHERE s.tenant_id = c.tenant_id
  RETURNING s.*;
$$;

REVOKE ALL ON FUNCTION public.claim_group_discovery_jobs(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_audience_discovery_jobs(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_group_discovery_jobs(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_audience_discovery_jobs(text, integer, integer) TO service_role;
