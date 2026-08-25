CREATE TABLE IF NOT EXISTS public.add_users_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.telegram_connections(id) ON DELETE CASCADE,
  destination_input text NOT NULL,
  destination_title text,
  destination_username text,
  destination_type text NOT NULL CHECK (destination_type IN ('GROUP', 'CHANNEL')),
  destination_peer_id text,
  selected_count integer NOT NULL DEFAULT 0,
  pending_count integer NOT NULL DEFAULT 0,
  processing_count integer NOT NULL DEFAULT 0,
  successful_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'PAUSED', 'COOLDOWN', 'COMPLETED', 'CANCELLED', 'FAILED')),
  cooldown_until timestamptz,
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.add_users_job_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.add_users_jobs(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.audience_contacts(id) ON DELETE CASCADE,
  telegram_user_id bigint,
  access_hash text,
  username text,
  display_name text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESSFUL', 'FAILED')),
  reason text,
  attempted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_add_users_jobs_tenant_customer
  ON public.add_users_jobs(tenant_id, customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_add_users_jobs_worker
  ON public.add_users_jobs(status, cooldown_until, updated_at)
  WHERE status IN ('PENDING', 'RUNNING', 'COOLDOWN');

CREATE INDEX IF NOT EXISTS idx_add_users_job_results_job_status
  ON public.add_users_job_results(job_id, status, created_at);

ALTER TABLE public.add_users_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.add_users_job_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS add_users_jobs_service_role_all ON public.add_users_jobs;
CREATE POLICY add_users_jobs_service_role_all
  ON public.add_users_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS add_users_job_results_service_role_all ON public.add_users_job_results;
CREATE POLICY add_users_job_results_service_role_all
  ON public.add_users_job_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.add_users_jobs TO service_role;
GRANT ALL ON public.add_users_job_results TO service_role;
