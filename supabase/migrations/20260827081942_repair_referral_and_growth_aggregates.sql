-- Repair referral code generation without weakening the function search path.
-- pgcrypto is installed in the extensions schema on hosted Supabase projects.
CREATE OR REPLACE FUNCTION public.ensure_referral_code(p_tenant_id uuid, p_customer_id uuid)
RETURNS public.referral_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result public.referral_codes;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.customers
    WHERE id = p_customer_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'CUSTOMER_TENANT_MISMATCH';
  END IF;

  INSERT INTO public.referral_codes(tenant_id, customer_id, code)
  VALUES (p_tenant_id, p_customer_id, encode(extensions.gen_random_bytes(24), 'hex'))
  ON CONFLICT (customer_id) DO NOTHING;

  SELECT * INTO result
  FROM public.referral_codes
  WHERE customer_id = p_customer_id;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.ensure_referral_code(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_referral_code(uuid, uuid) TO service_role;

-- Aggregate every persisted row in PostgreSQL. Detail rows remain independently paginated.
CREATE OR REPLACE FUNCTION public.growth_dashboard_range(
  p_tenant_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_bucket_seconds integer DEFAULT 86400
)
RETURNS TABLE (
  destination_id uuid,
  joins bigint,
  leaves bigint,
  messages bigint,
  reactions bigint,
  views bigint,
  forwards bigint,
  starting_members integer,
  ending_members integer,
  snapshot_count bigint,
  oldest_event_at timestamptz,
  latest_event_at timestamptz,
  chart jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH destinations AS (
  SELECT id FROM public.growth_destinations WHERE tenant_id = p_tenant_id
), event_totals AS (
  SELECT e.destination_id,
    count(*) FILTER (WHERE e.event_type = 'JOINED') AS joins,
    count(*) FILTER (WHERE e.event_type = 'LEFT') AS leaves,
    min(e.event_at) AS oldest_event_at,
    max(e.event_at) AS latest_event_at
  FROM public.growth_membership_events e JOIN destinations d ON d.id = e.destination_id
  WHERE e.event_at >= p_start AND e.event_at <= p_end
  GROUP BY e.destination_id
), content_totals AS (
  SELECT m.destination_id, count(*) AS messages,
    sum(m.reactions) AS reactions, sum(m.views) AS views, sum(m.forwards) AS forwards
  FROM public.growth_content_metrics m JOIN destinations d ON d.id = m.destination_id
  WHERE m.posted_at >= p_start AND m.posted_at <= p_end
  GROUP BY m.destination_id
), snapshot_totals AS (
  SELECT s.destination_id, count(*) AS snapshot_count,
    (array_agg(s.member_count ORDER BY s.snapshot_bucket ASC)
      FILTER (WHERE s.member_count IS NOT NULL))[1] AS starting_members,
    (array_agg(s.member_count ORDER BY s.snapshot_bucket DESC)
      FILTER (WHERE s.member_count IS NOT NULL))[1] AS ending_members
  FROM public.growth_snapshots s JOIN destinations d ON d.id = s.destination_id
  WHERE s.snapshot_bucket >= p_start AND s.snapshot_bucket <= p_end
  GROUP BY s.destination_id
), event_buckets AS (
  SELECT e.destination_id,
    to_timestamp(floor(extract(epoch FROM e.event_at) / greatest(p_bucket_seconds, 3600)) * greatest(p_bucket_seconds, 3600)) AS bucket,
    count(*) FILTER (WHERE e.event_type = 'JOINED') AS joins,
    count(*) FILTER (WHERE e.event_type = 'LEFT') AS leaves
  FROM public.growth_membership_events e JOIN destinations d ON d.id=e.destination_id
  WHERE e.event_at >= p_start AND e.event_at <= p_end
  GROUP BY e.destination_id, bucket
), content_buckets AS (
  SELECT m.destination_id,
    to_timestamp(floor(extract(epoch FROM m.posted_at) / greatest(p_bucket_seconds, 3600)) * greatest(p_bucket_seconds, 3600)) AS bucket,
    count(*) AS messages, sum(m.reactions) AS reactions, sum(m.views) AS views, sum(m.forwards) AS forwards
  FROM public.growth_content_metrics m JOIN destinations d ON d.id=m.destination_id
  WHERE m.posted_at >= p_start AND m.posted_at <= p_end
  GROUP BY m.destination_id, bucket
), snapshot_buckets AS (
  SELECT DISTINCT ON (s.destination_id, bucket) s.destination_id, bucket, s.member_count
  FROM (
    SELECT s.*,
      to_timestamp(floor(extract(epoch FROM s.snapshot_bucket) / greatest(p_bucket_seconds, 3600)) * greatest(p_bucket_seconds, 3600)) AS bucket
    FROM public.growth_snapshots s JOIN destinations d ON d.id=s.destination_id
    WHERE s.snapshot_bucket >= p_start AND s.snapshot_bucket <= p_end
  ) s
  ORDER BY s.destination_id, bucket, s.snapshot_bucket DESC
), bucket_keys AS (
  SELECT destination_id,bucket FROM event_buckets UNION
  SELECT destination_id,bucket FROM content_buckets UNION
  SELECT destination_id,bucket FROM snapshot_buckets
), chart_data AS (
  SELECT k.destination_id,
    jsonb_agg(jsonb_build_object(
      'bucket', k.bucket,
      'memberCount', sb.member_count,
      'joins', eb.joins,
      'leaves', eb.leaves,
      'netGrowth', CASE WHEN eb.destination_id IS NULL THEN NULL ELSE eb.joins-eb.leaves END,
      'messages', cb.messages,
      'reactions', cb.reactions,
      'views', cb.views,
      'forwards', cb.forwards
    ) ORDER BY k.bucket) AS chart
  FROM bucket_keys k
  LEFT JOIN event_buckets eb USING(destination_id,bucket)
  LEFT JOIN content_buckets cb USING(destination_id,bucket)
  LEFT JOIN snapshot_buckets sb USING(destination_id,bucket)
  GROUP BY k.destination_id
)
SELECT d.id,
  coalesce(e.joins,0), coalesce(e.leaves,0), coalesce(c.messages,0),
  c.reactions, c.views, c.forwards,
  s.starting_members, s.ending_members, coalesce(s.snapshot_count,0),
  e.oldest_event_at, e.latest_event_at, coalesce(cd.chart,'[]'::jsonb)
FROM destinations d
LEFT JOIN event_totals e ON e.destination_id=d.id
LEFT JOIN content_totals c ON c.destination_id=d.id
LEFT JOIN snapshot_totals s ON s.destination_id=d.id
LEFT JOIN chart_data cd ON cd.destination_id=d.id;
$$;

REVOKE ALL ON FUNCTION public.growth_dashboard_range(uuid,timestamptz,timestamptz,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.growth_dashboard_range(uuid,timestamptz,timestamptz,integer) TO service_role;
