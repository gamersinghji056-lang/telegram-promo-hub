ALTER TABLE public.telegram_connections
  ADD COLUMN IF NOT EXISTS telegram_premium boolean,
  ADD COLUMN IF NOT EXISTS telegram_premium_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS session_error_code text;

ALTER TABLE public.customer_preferences
  ADD COLUMN IF NOT EXISTS premium_emoji_session_mode text NOT NULL DEFAULT 'AUTO',
  ADD COLUMN IF NOT EXISTS preferred_premium_emoji_connection_id uuid REFERENCES public.telegram_connections(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_preferences_premium_emoji_session_mode_check'
  ) THEN
    ALTER TABLE public.customer_preferences
      ADD CONSTRAINT customer_preferences_premium_emoji_session_mode_check
      CHECK (premium_emoji_session_mode IN ('AUTO', 'MANUAL'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_telegram_connections_premium_pick
  ON public.telegram_connections(tenant_id, status, telegram_premium, health_score DESC, last_used_at ASC NULLS FIRST);

