-- Entity resolution metadata and background state for joins/imports/audience discovery.

ALTER TABLE public.discovered_groups
  ADD COLUMN IF NOT EXISTS access_hash text,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS can_send_messages boolean,
  ADD COLUMN IF NOT EXISTS writable_status text,
  ADD COLUMN IF NOT EXISTS last_resolved_connection_id uuid REFERENCES public.telegram_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS import_audit_id uuid;

ALTER TABLE public.audience_contacts
  ADD COLUMN IF NOT EXISTS access_hash text,
  ADD COLUMN IF NOT EXISTS source_connection_id uuid REFERENCES public.telegram_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entity_status text NOT NULL DEFAULT 'RESOLVABLE';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS link text;

CREATE TABLE IF NOT EXISTS public.group_import_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.telegram_connections(id) ON DELETE SET NULL,
  folder_link text NOT NULL,
  total_groups integer NOT NULL DEFAULT 0,
  duplicates integer NOT NULL DEFAULT 0,
  inaccessible integer NOT NULL DEFAULT 0,
  not_writable integer NOT NULL DEFAULT 0,
  already_saved integer NOT NULL DEFAULT 0,
  imported integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_import_audits_tenant
  ON public.group_import_audits(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.bulk_join_states (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.telegram_connections(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'IDLE',
  group_ids uuid[] NOT NULL DEFAULT '{}',
  current_index integer NOT NULL DEFAULT 0,
  joined integer NOT NULL DEFAULT 0,
  already_joined integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  inaccessible integer NOT NULL DEFAULT 0,
  cooldown integer NOT NULL DEFAULT 0,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audience_discovery_states (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.telegram_connections(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'IDLE',
  group_ids uuid[] NOT NULL DEFAULT '{}',
  processed_group_ids uuid[] NOT NULL DEFAULT '{}',
  users_found integer NOT NULL DEFAULT 0,
  new_users integer NOT NULL DEFAULT 0,
  duplicates integer NOT NULL DEFAULT 0,
  previously_saved integer NOT NULL DEFAULT 0,
  unavailable integer NOT NULL DEFAULT 0,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audience_discovery_states_status
  ON public.audience_discovery_states(status, updated_at);

