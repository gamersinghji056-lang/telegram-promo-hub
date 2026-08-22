CREATE TABLE IF NOT EXISTS public.bot_language_preferences (
  telegram_user_id bigint PRIMARY KEY,
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'zh-CN', 'ru', 'fa')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.bot_language_preferences TO service_role;

ALTER TABLE public.bot_language_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages bot_language_preferences" ON public.bot_language_preferences;
CREATE POLICY "Service role manages bot_language_preferences"
  ON public.bot_language_preferences
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.system_settings (key, value)
VALUES (
  'notifications',
  jsonb_build_object(
    'payment_confirmation_notifications', true,
    'plan_expiry_notifications', true,
    'quota_warning_notifications', true,
    'platform_announcements_enabled', true
  )
)
ON CONFLICT (key) DO UPDATE
SET value = public.system_settings.value || excluded.value,
    updated_at = now();
