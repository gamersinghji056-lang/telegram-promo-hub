ALTER TABLE public.growth_membership_events
  ADD COLUMN source_type text,
  ADD COLUMN source_event_id bigint,
  ADD COLUMN actor_user_id bigint;

UPDATE public.growth_membership_events
SET source_type = 'ADMIN_LOG', source_event_id = telegram_event_id
WHERE source_type IS NULL;

ALTER TABLE public.growth_membership_events
  ALTER COLUMN source_type SET NOT NULL,
  ALTER COLUMN source_event_id SET NOT NULL,
  ADD CONSTRAINT growth_membership_source_type_check
    CHECK (source_type IN ('ADMIN_LOG','MESSAGE_SERVICE'));

ALTER TABLE public.growth_membership_events
  DROP CONSTRAINT IF EXISTS growth_membership_events_destination_id_telegram_event_id_key;

CREATE UNIQUE INDEX growth_membership_exact_source_once
  ON public.growth_membership_events(destination_id, source_type, source_event_id, telegram_user_id)
  NULLS NOT DISTINCT;

ALTER TABLE public.growth_collection_checkpoints
  DROP CONSTRAINT IF EXISTS growth_collection_checkpoints_collection_type_check;
ALTER TABLE public.growth_collection_checkpoints
  ADD CONSTRAINT growth_collection_checkpoints_collection_type_check
  CHECK (collection_type IN ('ADMIN_LOG','MEMBERSHIP_HISTORY','MESSAGES','SNAPSHOT'));

CREATE INDEX growth_membership_semantic_dedupe_idx
  ON public.growth_membership_events(destination_id, telegram_user_id, event_type, event_at);
