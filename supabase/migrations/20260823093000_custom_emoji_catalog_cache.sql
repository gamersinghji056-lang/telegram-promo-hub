CREATE TABLE IF NOT EXISTS public.custom_emoji_catalog_cache (
  cache_key text PRIMARY KEY,
  tenant_id uuid NOT NULL,
  connection_id uuid NOT NULL REFERENCES public.telegram_connections(id) ON DELETE CASCADE,
  tab text NOT NULL,
  query text NOT NULL DEFAULT '',
  catalog jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  stale_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_custom_emoji_catalog_cache_connection
  ON public.custom_emoji_catalog_cache(connection_id, tab, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_custom_emoji_catalog_cache_expires
  ON public.custom_emoji_catalog_cache(expires_at);

ALTER TABLE public.custom_emoji_catalog_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_emoji_catalog_cache_service_role_all
  ON public.custom_emoji_catalog_cache;

CREATE POLICY custom_emoji_catalog_cache_service_role_all
  ON public.custom_emoji_catalog_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.custom_emoji_catalog_cache TO service_role;
