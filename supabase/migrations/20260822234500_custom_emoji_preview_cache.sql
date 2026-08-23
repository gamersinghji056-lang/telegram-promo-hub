CREATE TABLE IF NOT EXISTS public.custom_emoji_preview_cache (
  document_id text PRIMARY KEY,
  media_identity text NOT NULL DEFAULT 'telegram-document',
  mime_type text NOT NULL,
  preview_format text NOT NULL CHECK (preview_format IN ('image', 'tgs', 'webm', 'unknown')),
  data_url text NOT NULL,
  fallback text NOT NULL DEFAULT '*',
  byte_length integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_custom_emoji_preview_cache_expires
  ON public.custom_emoji_preview_cache(expires_at);

ALTER TABLE public.custom_emoji_preview_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_emoji_preview_cache_service_role_all
  ON public.custom_emoji_preview_cache;

CREATE POLICY custom_emoji_preview_cache_service_role_all
  ON public.custom_emoji_preview_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.custom_emoji_preview_cache TO service_role;
