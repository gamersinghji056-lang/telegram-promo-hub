ALTER TABLE public.audience_contacts
  ADD COLUMN IF NOT EXISTS has_username boolean
  GENERATED ALWAYS AS (username IS NOT NULL AND btrim(username) <> '') STORED;

CREATE INDEX IF NOT EXISTS idx_audience_contacts_dm_selection
  ON public.audience_contacts(
    tenant_id,
    eligibility,
    contact_count,
    has_username DESC,
    messages_observed DESC,
    recent_activity_at DESC,
    first_found_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_discovered_groups_writable_category
  ON public.discovered_groups(tenant_id, status, can_send_messages, writable_status);

CREATE INDEX IF NOT EXISTS idx_campaign_jobs_campaign_status
  ON public.campaign_jobs(tenant_id, campaign_id, status);

CREATE OR REPLACE VIEW public.campaign_job_stats AS
SELECT
  c.tenant_id,
  c.id AS campaign_id,
  c.type AS campaign_type,
  c.status AS campaign_status,
  count(j.id)::integer AS total_messages,
  count(*) FILTER (WHERE j.status = 'SENT')::integer AS sent_messages,
  count(*) FILTER (
    WHERE j.status IN ('QUEUED', 'PROCESSING', 'HELD', 'PAUSED', 'COOLDOWN')
  )::integer AS pending_messages,
  count(*) FILTER (
    WHERE j.status IN (
      'FAILED',
      'SKIPPED',
      'EXCLUDED',
      'ENTITY_UNAVAILABLE',
      'NOT_WRITABLE',
      'CANCELLED'
    )
  )::integer AS failed_messages
FROM public.campaigns c
LEFT JOIN public.campaign_jobs j
  ON j.campaign_id = c.id
 AND j.tenant_id = c.tenant_id
WHERE c.deleted_at IS NULL
GROUP BY c.tenant_id, c.id, c.type, c.status;
