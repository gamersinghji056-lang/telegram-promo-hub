-- Core Mini App modules: session linking, safer audience defaults, job execution metadata.

ALTER TABLE public.telegram_connections
  ADD COLUMN IF NOT EXISTS link_code_hash text,
  ADD COLUMN IF NOT EXISTS link_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS encrypted_session text,
  ADD COLUMN IF NOT EXISTS pending_session text,
  ADD COLUMN IF NOT EXISTS pending_phone text,
  ADD COLUMN IF NOT EXISTS phone_code_hash text,
  ADD COLUMN IF NOT EXISTS phone_masked text,
  ADD COLUMN IF NOT EXISTS auth_step text,
  ADD COLUMN IF NOT EXISTS telegram_user_id bigint,
  ADD COLUMN IF NOT EXISTS last_used_at timestamptz,
  ADD COLUMN IF NOT EXISTS cooldown_until timestamptz,
  ADD COLUMN IF NOT EXISTS health text NOT NULL DEFAULT 'REQUIRES_ACTION',
  ADD COLUMN IF NOT EXISTS restriction_status text NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS restriction_reason text,
  ADD COLUMN IF NOT EXISTS disconnected_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_conn_link_code_hash
  ON public.telegram_connections(link_code_hash)
  WHERE link_code_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conn_tenant_status
  ON public.telegram_connections(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_conn_tenant_user_session
  ON public.telegram_connections(tenant_id, telegram_user_id);

ALTER TABLE public.discovered_groups
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.campaign_jobs
  ADD COLUMN IF NOT EXISTS connection_id uuid REFERENCES public.telegram_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_jobs_tenant_status
  ON public.campaign_jobs(tenant_id, status, run_after);

CREATE INDEX IF NOT EXISTS idx_jobs_connection
  ON public.campaign_jobs(connection_id);

ALTER TABLE public.audience_contacts
  ALTER COLUMN eligibility SET DEFAULT 'REQUIRES_OPT_IN';

UPDATE public.audience_contacts
SET eligibility = 'REQUIRES_OPT_IN'
WHERE eligibility = 'ELIGIBLE';

UPDATE public.plans
SET max_connections = 20
WHERE code = 'PREMIUM' AND max_connections < 20;
