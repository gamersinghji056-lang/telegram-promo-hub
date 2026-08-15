-- Reconcile historical repeating group campaign counters when older worker runs
-- completed cycles before cumulative sent/failed counts were persisted.

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
base AS (
  SELECT
    c.tenant_id,
    c.id AS campaign_id,
    c.type AS campaign_type,
    c.status AS campaign_status,
    COALESCE(gt.groups_per_cycle, c.total_targets, 0)::integer AS groups_per_cycle,
    COALESCE(c.cycles_completed, 0)::integer AS completed_cycles,
    COALESCE(c.completed_count, 0)::integer AS stored_sent,
    COALESCE(c.failed_count, 0)::integer AS stored_failed,
    COALESCE(j.current_sent, 0)::integer AS current_sent,
    COALESCE(j.current_processing, 0)::integer AS current_processing,
    COALESCE(j.current_pending, 0)::integer AS current_pending,
    COALESCE(j.current_failed, 0)::integer AS current_failed
  FROM public.campaigns c
  LEFT JOIN current_jobs j
    ON j.campaign_id = c.id
   AND j.tenant_id = c.tenant_id
  LEFT JOIN group_targets gt
    ON gt.campaign_id = c.id
   AND gt.tenant_id = c.tenant_id
  WHERE c.deleted_at IS NULL
),
normalized AS (
  SELECT
    *,
    CASE
      WHEN campaign_type = 'GROUP'
        THEN (completed_cycles * groups_per_cycle)::integer
      ELSE 0
    END AS historical_attempted,
    (current_sent + current_failed + current_processing)::integer AS current_cycle_attempted
  FROM base
),
reconciled AS (
  SELECT
    *,
    CASE
      WHEN campaign_type = 'GROUP'
        THEN GREATEST(historical_attempted - stored_sent - stored_failed, 0)::integer
      ELSE 0
    END AS missing_historical_attempts
  FROM normalized
)
SELECT
  tenant_id,
  campaign_id,
  campaign_type,
  campaign_status,
  CASE
    WHEN campaign_type = 'GROUP'
      THEN (
        stored_sent +
        stored_failed +
        missing_historical_attempts +
        current_sent +
        current_failed +
        current_pending
      )::integer
    ELSE (current_sent + current_failed + current_pending)::integer
  END AS total_messages,
  CASE
    WHEN campaign_type = 'GROUP'
      THEN (stored_sent + current_sent)::integer
    ELSE current_sent::integer
  END AS sent_messages,
  current_pending::integer AS pending_messages,
  CASE
    WHEN campaign_type = 'GROUP'
      THEN (stored_failed + missing_historical_attempts + current_failed)::integer
    ELSE current_failed::integer
  END AS failed_messages,
  groups_per_cycle::integer,
  completed_cycles::integer,
  current_cycle_attempted::integer,
  CASE
    WHEN campaign_type = 'GROUP'
      THEN (historical_attempted + current_cycle_attempted)::integer
    ELSE current_cycle_attempted::integer
  END AS total_attempted
FROM reconciled;
