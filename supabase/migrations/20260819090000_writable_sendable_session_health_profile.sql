-- Separate writable/sendable evidence, persistent session health, category type, and profile names.

ALTER TABLE public.group_categories
  ADD COLUMN IF NOT EXISTS category_type text NOT NULL DEFAULT 'NW_NS';

UPDATE public.group_categories
SET category_type = 'NW_NS'
WHERE category_type IS NULL OR category_type NOT IN ('NW_NS', 'WRITABLE', 'SENDABLE');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'group_categories_category_type_check'
  ) THEN
    ALTER TABLE public.group_categories
      ADD CONSTRAINT group_categories_category_type_check
      CHECK (category_type IN ('NW_NS', 'WRITABLE', 'SENDABLE'));
  END IF;
END $$;

ALTER TABLE public.discovered_groups
  ADD COLUMN IF NOT EXISTS writable_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_write_error text,
  ADD COLUMN IF NOT EXISTS sendable_status text NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS sendable_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_send_test_connection_id uuid REFERENCES public.telegram_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_send_error text;

UPDATE public.discovered_groups
SET sendable_status = 'UNKNOWN'
WHERE sendable_status IS NULL OR sendable_status NOT IN ('SENDABLE', 'JOIN_REQUIRED', 'NOT_SENDABLE', 'INACCESSIBLE', 'UNKNOWN');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'discovered_groups_sendable_status_check'
  ) THEN
    ALTER TABLE public.discovered_groups
      ADD CONSTRAINT discovered_groups_sendable_status_check
      CHECK (sendable_status IN ('SENDABLE', 'JOIN_REQUIRED', 'NOT_SENDABLE', 'INACCESSIBLE', 'UNKNOWN'));
  END IF;
END $$;

ALTER TABLE public.telegram_connections
  ADD COLUMN IF NOT EXISTS health_score integer NOT NULL DEFAULT 75,
  ADD COLUMN IF NOT EXISTS health_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS health_summary text NOT NULL DEFAULT 'Health not tested yet.';

UPDATE public.telegram_connections
SET
  health_score = CASE
    WHEN status = 'CONNECTED' AND COALESCE(health, '') = 'HEALTHY' THEN GREATEST(health_score, 85)
    WHEN status IN ('ERROR', 'DISCONNECTED') THEN LEAST(health_score, 40)
    ELSE health_score
  END,
  health_updated_at = COALESCE(health_updated_at, now()),
  health_summary = COALESCE(NULLIF(health_summary, ''), 'Health not tested yet.');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'telegram_connections_health_score_check'
  ) THEN
    ALTER TABLE public.telegram_connections
      ADD CONSTRAINT telegram_connections_health_score_check
      CHECK (health_score BETWEEN 0 AND 100);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.session_health_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.telegram_connections(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  score_delta integer NOT NULL DEFAULT 0,
  reason text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_health_events_connection
  ON public.session_health_events(tenant_id, connection_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telegram_connections_health_pick
  ON public.telegram_connections(tenant_id, status, health_score DESC, last_used_at ASC NULLS FIRST);

CREATE INDEX IF NOT EXISTS idx_group_categories_type
  ON public.group_categories(tenant_id, category_type);

CREATE INDEX IF NOT EXISTS idx_discovered_groups_sendable
  ON public.discovered_groups(tenant_id, status, sendable_status);

CREATE SEQUENCE IF NOT EXISTS public.customer_profile_name_seq START WITH 1;

CREATE OR REPLACE FUNCTION public.next_customer_profile_name()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'User' || lpad(nextval('public.customer_profile_name_seq')::text, 3, '0')
$$;

WITH blanks AS (
  SELECT
    id,
    'User' || lpad(row_number() OVER (ORDER BY created_at, id)::text, 3, '0') AS generated_name
  FROM public.customers
  WHERE name IS NULL OR btrim(name) = ''
)
UPDATE public.customers c
SET name = blanks.generated_name
FROM blanks
WHERE c.id = blanks.id;

GRANT ALL ON public.session_health_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.customer_profile_name_seq TO service_role;
GRANT EXECUTE ON FUNCTION public.next_customer_profile_name() TO service_role;
ALTER TABLE public.session_health_events ENABLE ROW LEVEL SECURITY;
