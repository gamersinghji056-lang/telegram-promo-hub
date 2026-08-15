-- Expose attempted-message counters for repeating group campaigns without
-- counting future cycles that have not started.

DROP VIEW IF EXISTS public.campaign_job_stats;

CREATE VIEW public.campaign_job_stats AS
WITH current_jobs AS (
  SELECT
    j.tenant_id,
    j.campaign_id,
    count(j.id)::integer AS current_total,
    count(*) FILTER (WHERE j.status = 'SENT')::integer AS current_sent,
    count(*) FILTER (WHERE j.status = 'PROCESSING')::integer AS current_processing,
    count(*) FILTER (
      WHERE j.status IN ('QUEUED', 'HELD', 'PAUSED', 'COOLDOWN')
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
group_targets AS (
  SELECT
    g.tenant_id,
    g.campaign_id,
    count(g.id)::integer AS groups_per_cycle
  FROM public.campaign_groups g
  GROUP BY g.tenant_id, g.campaign_id
),
normalized AS (
  SELECT
    c.tenant_id,
    c.id AS campaign_id,
    c.type AS campaign_type,
    c.status AS campaign_status,
    COALESCE(gt.groups_per_cycle, c.total_targets, 0)::integer AS groups_per_cycle,
    COALESCE(c.cycles_completed, 0)::integer AS completed_cycles,
    (
      COALESCE(j.current_sent, 0) +
      COALESCE(j.current_failed, 0) +
      COALESCE(j.current_processing, 0)
    )::integer AS current_cycle_attempted,
    CASE
      WHEN c.type = 'GROUP'
        THEN (
          COALESCE(c.cycles_completed, 0) * COALESCE(gt.groups_per_cycle, c.total_targets, 0) +
          COALESCE(j.current_sent, 0) +
          COALESCE(j.current_failed, 0) +
          COALESCE(j.current_processing, 0)
        )::integer
      ELSE (
        COALESCE(j.current_sent, 0) +
        COALESCE(j.current_failed, 0) +
        COALESCE(j.current_processing, 0)
      )::integer
    END AS total_attempted,
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
    COALESCE(j.current_pending, 0)::integer AS pending_messages
  FROM public.campaigns c
  LEFT JOIN current_jobs j
    ON j.campaign_id = c.id
   AND j.tenant_id = c.tenant_id
  LEFT JOIN group_targets gt
    ON gt.campaign_id = c.id
   AND gt.tenant_id = c.tenant_id
  WHERE c.deleted_at IS NULL
)
SELECT
  tenant_id,
  campaign_id,
  campaign_type,
  campaign_status,
  CASE
    WHEN campaign_type = 'GROUP'
      THEN (sent_messages + failed_messages + pending_messages)::integer
    ELSE (sent_messages + failed_messages + pending_messages)::integer
  END AS total_messages,
  sent_messages::integer,
  pending_messages::integer,
  failed_messages::integer,
  groups_per_cycle::integer,
  completed_cycles::integer,
  current_cycle_attempted::integer,
  total_attempted::integer
FROM normalized;
