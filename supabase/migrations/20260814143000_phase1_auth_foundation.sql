ALTER TABLE public.bot_states
  ADD COLUMN IF NOT EXISTS flow text NOT NULL DEFAULT 'IDLE',
  ADD COLUMN IF NOT EXISTS step text NOT NULL DEFAULT 'IDLE',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '20 minutes'),
  ADD COLUMN IF NOT EXISTS flow_token_hash text;

UPDATE public.bot_states
SET
  flow = CASE
    WHEN state LIKE 'REGISTRATION:%' THEN 'REGISTRATION'
    WHEN state LIKE 'LOGIN:%' THEN 'LOGIN'
    ELSE flow
  END,
  step = CASE
    WHEN position(':' in state) > 0 THEN split_part(state, ':', 2)
    ELSE step
  END
WHERE state IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_states_flow_token
  ON public.bot_states(flow_token_hash)
  WHERE flow_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bot_states_expires
  ON public.bot_states(expires_at);

CREATE INDEX IF NOT EXISTS idx_sessions_expires
  ON public.customer_sessions(expires_at);

COMMENT ON TABLE public.bot_states IS
  'Per-Telegram-user short-lived bot conversation state. Never store passwords or session tokens here.';
