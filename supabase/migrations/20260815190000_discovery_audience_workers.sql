-- Persistent group discovery and explicit audience discovery results.

ALTER TABLE public.discovered_groups
  ADD COLUMN IF NOT EXISTS discovery_source text NOT NULL DEFAULT 'AUTO',
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_groups_tenant_source_status
  ON public.discovered_groups(tenant_id, discovery_source, status);

CREATE TABLE IF NOT EXISTS public.group_discovery_states (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.telegram_connections(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'IDLE',
  keywords text[] NOT NULL DEFAULT '{}',
  total_found integer NOT NULL DEFAULT 0,
  new_groups_found integer NOT NULL DEFAULT 0,
  last_search_at timestamptz,
  next_search_at timestamptz,
  last_error text,
  batches_completed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_discovery_states_due
  ON public.group_discovery_states(status, next_search_at);

CREATE TABLE IF NOT EXISTS public.audience_discovery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_group_id uuid REFERENCES public.discovered_groups(id) ON DELETE SET NULL,
  connection_id uuid REFERENCES public.telegram_connections(id) ON DELETE SET NULL,
  status text NOT NULL,
  users_found integer NOT NULL DEFAULT 0,
  duplicates integer NOT NULL DEFAULT 0,
  already_saved integer NOT NULL DEFAULT 0,
  unavailable integer NOT NULL DEFAULT 0,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audience_discovery_runs_tenant
  ON public.audience_discovery_runs(tenant_id, created_at DESC);

