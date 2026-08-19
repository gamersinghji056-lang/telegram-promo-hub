UPDATE public.plans
SET is_public = false,
    is_custom = true,
    updated_at = now()
WHERE upper(code) IN ('FREE', 'BASIC', 'PREMIUM', 'STARTER', 'GROWTH', 'SCALE')
   OR upper(name) IN ('FREE', 'BASIC', 'PREMIUM', 'STARTER', 'GROWTH', 'SCALE');

UPDATE public.system_settings
SET value = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(value, '{default_plan_code}', '"TEST"', true),
          '{default_duration_days}',
          COALESCE(value->'default_duration_days', '30'::jsonb),
          true
        ),
        '{new_user_status}',
        COALESCE(value->'new_user_status', '"ACTIVE"'::jsonb),
        true
      ),
      '{welcome_message}',
      COALESCE(value->'welcome_message', '"Welcome to WPAY. Your account is ready."'::jsonb),
      true
    ),
    updated_at = now()
WHERE key = 'registration'
  AND COALESCE(value->>'default_plan_code', '') IN ('', 'FREE', 'BASIC', 'PREMIUM', 'STARTER', 'GROWTH', 'SCALE');

INSERT INTO public.system_settings (key, value)
VALUES (
  'registration',
  '{
    "registration_enabled": true,
    "email_verification_enabled": false,
    "default_plan_code": "TEST",
    "default_duration_days": 30,
    "new_user_status": "ACTIVE",
    "welcome_message": "Welcome to WPAY. Your account is ready."
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

UPDATE public.system_settings
SET value = jsonb_set(
      jsonb_set(
        jsonb_set(
          value,
          '{default_duration_days}',
          COALESCE(value->'default_duration_days', '30'::jsonb),
          true
        ),
        '{new_user_status}',
        COALESCE(value->'new_user_status', '"ACTIVE"'::jsonb),
        true
      ),
      '{welcome_message}',
      COALESCE(value->'welcome_message', '"Welcome to WPAY. Your account is ready."'::jsonb),
      true
    ),
    updated_at = now()
WHERE key = 'registration';
