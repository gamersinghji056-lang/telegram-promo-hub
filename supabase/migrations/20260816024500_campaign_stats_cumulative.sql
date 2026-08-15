-- Keep campaign message counters reconciled across repeating group cycles.

CREATE OR REPLACE VIEW public.campaign_job_stats AS
WITH current_jobs AS (
  SELECT
    j.tenant_id,
    j.campaign_id,
    count(j.id)::integer AS current_total,
    count(*) FILTER (WHERE j.status = 'SENT')::integer AS current_sent,
    count(*) FILTER (
      WHERE j.status IN ('QUEUED', 'PROCESSING', 'HELD', 'PAUSED', 'COOLDOWN')
    )::integer AS current_pending,
    count(*) FILTER (
      WHERE j.status IN (
        'FAILED',
        'SKIPPED',
        'EXCLUDED',
        'ENTITY_UNAVAILABLE',
        'NOT_WRITABLE',
        'CANCELLED'
      )
    )::integer AS current_failed
  FROM public.campaign_jobs j
  GROUP BY j.tenant_id, j.campaign_id
),
normalized AS (
  SELECT
    c.tenant_id,
    c.id AS campaign_id,
    c.type AS campaign_type,
    c.status AS campaign_status,
    CASE
      WHEN c.type = 'GROUP' AND COALESCE(c.cycles_completed, 0) > 0
        THEN COALESCE(c.completed_count, 0) + COALESCE(j.current_sent, 0)
      ELSE COALESCE(j.current_sent, 0)
    END AS sent_messages,
    CASE
      WHEN c.type = 'GROUP' AND COALESCE(c.cycles_completed, 0) > 0
        THEN COALESCE(c.failed_count, 0) + COALESCE(j.current_failed, 0)
      ELSE COALESCE(j.current_failed, 0)
    END AS failed_messages,
    COALESCE(j.current_pending, 0) AS pending_messages
  FROM public.campaigns c
  LEFT JOIN current_jobs j
    ON j.campaign_id = c.id
   AND j.tenant_id = c.tenant_id
  WHERE c.deleted_at IS NULL
)
SELECT
  tenant_id,
  campaign_id,
  campaign_type,
  campaign_status,
  (sent_messages + failed_messages + pending_messages)::integer AS total_messages,
  sent_messages::integer,
  pending_messages::integer,
  failed_messages::integer
FROM normalized;
