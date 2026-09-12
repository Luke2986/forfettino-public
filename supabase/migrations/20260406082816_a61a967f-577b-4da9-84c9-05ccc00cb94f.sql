
CREATE INDEX IF NOT EXISTS idx_receipts_user_created ON receipts(user_id, created_at);

CREATE OR REPLACE FUNCTION public.get_ttv_dashboard(
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_trend_days INTEGER DEFAULT 30
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  WITH user_ttv AS (
    SELECT
      p.user_id,
      p.created_at AS signup_at,
      EXTRACT(EPOCH FROM (MIN(r.created_at) - p.created_at)) / 60.0 AS ttv_minutes,
      MIN(r.created_at)::date AS activation_day
    FROM profiles p
    JOIN receipts r ON r.user_id = p.user_id
    WHERE p.onboarding_completed = true
      AND p.is_internal IS NOT TRUE
      AND (p_from_date IS NULL OR p.created_at >= p_from_date::timestamptz)
      AND (p_to_date IS NULL OR p.created_at < (p_to_date + 1)::timestamptz)
    GROUP BY p.user_id, p.created_at
    HAVING EXTRACT(EPOCH FROM (MIN(r.created_at) - p.created_at)) >= 0
  ),
  all_signups AS (
    SELECT COUNT(*)::BIGINT AS total_signups
    FROM profiles p
    WHERE p.onboarding_completed = true
      AND p.is_internal IS NOT TRUE
      AND (p_from_date IS NULL OR p.created_at >= p_from_date::timestamptz)
      AND (p_to_date IS NULL OR p.created_at < (p_to_date + 1)::timestamptz)
  ),
  stats AS (
    SELECT
      COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY ttv_minutes), 0) AS median_minutes,
      COALESCE(percentile_cont(0.9) WITHIN GROUP (ORDER BY ttv_minutes), 0) AS p90_minutes,
      COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY ttv_minutes), 0) AS p95_minutes,
      COUNT(*)::BIGINT AS total_activated
    FROM user_ttv
  ),
  stats_json AS (
    SELECT json_build_object(
      'median_minutes', ROUND(s.median_minutes::numeric, 1),
      'p90_minutes', ROUND(s.p90_minutes::numeric, 1),
      'p95_minutes', ROUND(s.p95_minutes::numeric, 1),
      'total_activated', s.total_activated,
      'total_signups', a.total_signups,
      'activation_rate', CASE
        WHEN a.total_signups = 0 THEN 0
        ELSE ROUND((s.total_activated::numeric / a.total_signups * 100), 1)
      END
    ) AS val
    FROM stats s, all_signups a
  ),
  by_gestione AS (
    SELECT
      COALESCE(fys.inps_type, 'sconosciuta') AS gestione,
      ROUND(COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY ut.ttv_minutes), 0)::numeric, 1) AS median_minutes,
      ROUND(COALESCE(percentile_cont(0.9) WITHIN GROUP (ORDER BY ut.ttv_minutes), 0)::numeric, 1) AS p90_minutes,
      COUNT(*)::BIGINT AS user_count
    FROM user_ttv ut
    LEFT JOIN LATERAL (
      SELECT f.inps_type
      FROM fiscal_year_settings f
      WHERE f.user_id = ut.user_id
      ORDER BY f.fiscal_year DESC
      LIMIT 1
    ) fys ON true
    GROUP BY COALESCE(fys.inps_type, 'sconosciuta')
    ORDER BY user_count DESC
  ),
  gestione_json AS (
    SELECT COALESCE(json_agg(
      json_build_object(
        'gestione', bg.gestione,
        'median_minutes', bg.median_minutes,
        'p90_minutes', bg.p90_minutes,
        'user_count', bg.user_count
      )
    ), '[]'::json) AS val
    FROM by_gestione bg
  ),
  date_series AS (
    SELECT d::date AS day
    FROM generate_series(
      CURRENT_DATE - (p_trend_days - 1),
      CURRENT_DATE,
      '1 day'::interval
    ) d
  ),
  daily_agg AS (
    SELECT
      ds.day,
      ROUND(COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY ut.ttv_minutes), 0)::numeric, 1) AS median_minutes_val,
      COUNT(ut.user_id)::BIGINT AS activated_count
    FROM date_series ds
    LEFT JOIN user_ttv ut ON ut.activation_day = ds.day
    GROUP BY ds.day
    ORDER BY ds.day ASC
  ),
  trend_json AS (
    SELECT COALESCE(json_agg(
      json_build_object(
        'day', da.day,
        'median_minutes', CASE WHEN da.activated_count = 0 THEN NULL ELSE da.median_minutes_val END,
        'activated_count', da.activated_count
      )
    ), '[]'::json) AS val
    FROM daily_agg da
  )
  SELECT json_build_object(
    'stats', sj.val,
    'by_gestione', gj.val,
    'daily_trend', tj.val
  )
  INTO result
  FROM stats_json sj, gestione_json gj, trend_json tj;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ttv_dashboard(DATE, DATE, INTEGER) TO authenticated;
