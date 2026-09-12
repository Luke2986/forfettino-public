-- Story 70-5: Wizard A/B Test Infrastructure

-- 1. Colonna profiles.wizard_variant
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wizard_variant TEXT DEFAULT NULL;

-- 2. get_wizard_funnel — aggiunta p_wizard_variant
CREATE OR REPLACE FUNCTION public.get_wizard_funnel(
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_gestione_filter TEXT DEFAULT NULL,
  p_wizard_variant TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  step_order CONSTANT text[] := '{gestione,annoIscrizione,riduzione35,acconti,profilo,datiFiscali,prudenza,scadenze,conferma}';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  IF p_gestione_filter IS NOT NULL AND p_gestione_filter NOT IN ('separata', 'artigiani', 'commercianti') THEN
    RAISE EXCEPTION 'Invalid gestione filter: %', p_gestione_filter;
  END IF;

  WITH valid_users AS (
    SELECT user_id FROM profiles WHERE is_internal IS NOT TRUE
  ),
  step_entered AS (
    SELECT e.props->>'step_id' AS step_id, COUNT(DISTINCT e.user_id) AS cnt
    FROM event_logs e
    JOIN valid_users v ON v.user_id = e.user_id
    WHERE e.event_name = 'wizard_step_entered'
      AND (p_from_date IS NULL OR e.created_at >= p_from_date::timestamptz)
      AND (p_to_date IS NULL OR e.created_at < (p_to_date + 1)::timestamptz)
      AND (p_gestione_filter IS NULL OR e.props->>'gestione' = p_gestione_filter)
      AND (p_wizard_variant IS NULL OR COALESCE(e.props->>'variant', 'control') = p_wizard_variant)
    GROUP BY e.props->>'step_id'
  ),
  step_completed AS (
    SELECT e.props->>'step_id' AS step_id, COUNT(DISTINCT e.user_id) AS cnt
    FROM event_logs e
    JOIN valid_users v ON v.user_id = e.user_id
    WHERE e.event_name = 'wizard_step_completed'
      AND (p_from_date IS NULL OR e.created_at >= p_from_date::timestamptz)
      AND (p_to_date IS NULL OR e.created_at < (p_to_date + 1)::timestamptz)
      AND (p_gestione_filter IS NULL OR e.props->>'gestione' = p_gestione_filter)
      AND (p_wizard_variant IS NULL OR COALESCE(e.props->>'variant', 'control') = p_wizard_variant)
    GROUP BY e.props->>'step_id'
  ),
  funnel AS (
    SELECT
      s.step_id,
      (array_position(step_order, s.step_id) - 1) AS step_order,
      COALESCE(se.cnt, 0) AS entered,
      COALESCE(sc.cnt, 0) AS completed,
      COALESCE(ROUND(COALESCE(sc.cnt, 0)::NUMERIC / NULLIF(se.cnt, 0) * 100, 1), 0) AS completion_rate,
      COALESCE(ROUND(100 - COALESCE(sc.cnt, 0)::NUMERIC / NULLIF(se.cnt, 0) * 100, 1), 0) AS drop_off_rate
    FROM unnest(step_order) WITH ORDINALITY AS s(step_id, ord)
    LEFT JOIN step_entered se ON se.step_id = s.step_id
    LEFT JOIN step_completed sc ON sc.step_id = s.step_id
    ORDER BY s.ord
  ),
  funnel_json AS (
    SELECT COALESCE(json_agg(
      json_build_object(
        'step_id', f.step_id,
        'step_order', f.step_order,
        'entered', f.entered,
        'completed', f.completed,
        'completion_rate', f.completion_rate,
        'drop_off_rate', f.drop_off_rate
      )
    ), '[]'::json) AS val
    FROM funnel f
  ),
  time_per_step AS (
    SELECT
      e.props->>'step_id' AS step_id,
      ROUND(AVG((e.props->>'time_spent_seconds')::NUMERIC), 1) AS avg_seconds,
      ROUND(COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY (e.props->>'time_spent_seconds')::NUMERIC), 0)::NUMERIC, 1) AS median_seconds,
      ROUND(COALESCE(percentile_cont(0.9) WITHIN GROUP (ORDER BY (e.props->>'time_spent_seconds')::NUMERIC), 0)::NUMERIC, 1) AS p90_seconds
    FROM event_logs e
    JOIN valid_users v ON v.user_id = e.user_id
    WHERE e.event_name = 'wizard_step_completed'
      AND (p_from_date IS NULL OR e.created_at >= p_from_date::timestamptz)
      AND (p_to_date IS NULL OR e.created_at < (p_to_date + 1)::timestamptz)
      AND (p_gestione_filter IS NULL OR e.props->>'gestione' = p_gestione_filter)
      AND (p_wizard_variant IS NULL OR COALESCE(e.props->>'variant', 'control') = p_wizard_variant)
    GROUP BY e.props->>'step_id'
  ),
  time_json AS (
    SELECT COALESCE(json_agg(
      json_build_object(
        'step_id', t.step_id,
        'avg_seconds', t.avg_seconds,
        'median_seconds', t.median_seconds,
        'p90_seconds', t.p90_seconds
      )
    ), '[]'::json) AS val
    FROM time_per_step t
  ),
  abandoned_total AS (
    SELECT COUNT(DISTINCT e.user_id) AS total
    FROM event_logs e
    JOIN valid_users v ON v.user_id = e.user_id
    WHERE e.event_name = 'wizard_abandoned'
      AND (p_from_date IS NULL OR e.created_at >= p_from_date::timestamptz)
      AND (p_to_date IS NULL OR e.created_at < (p_to_date + 1)::timestamptz)
      AND (p_gestione_filter IS NULL OR e.props->>'gestione' = p_gestione_filter)
      AND (p_wizard_variant IS NULL OR COALESCE(e.props->>'variant', 'control') = p_wizard_variant)
  ),
  abandonment AS (
    SELECT
      e.props->>'last_step_id' AS last_step_id,
      COUNT(DISTINCT e.user_id) AS cnt
    FROM event_logs e
    JOIN valid_users v ON v.user_id = e.user_id
    WHERE e.event_name = 'wizard_abandoned'
      AND (p_from_date IS NULL OR e.created_at >= p_from_date::timestamptz)
      AND (p_to_date IS NULL OR e.created_at < (p_to_date + 1)::timestamptz)
      AND (p_gestione_filter IS NULL OR e.props->>'gestione' = p_gestione_filter)
      AND (p_wizard_variant IS NULL OR COALESCE(e.props->>'variant', 'control') = p_wizard_variant)
    GROUP BY e.props->>'last_step_id'
    ORDER BY cnt DESC
  ),
  abandonment_json AS (
    SELECT COALESCE(json_agg(
      json_build_object(
        'last_step_id', a.last_step_id,
        'count', a.cnt,
        'pct', ROUND(a.cnt::NUMERIC / NULLIF(at.total, 0) * 100, 1)
      )
    ), '[]'::json) AS val
    FROM abandonment a, abandoned_total at
  ),
  summary_data AS (
    SELECT
      (SELECT COUNT(DISTINCT e.user_id) FROM event_logs e JOIN valid_users v ON v.user_id = e.user_id
       WHERE e.event_name = 'wizard_step_entered'
         AND (p_from_date IS NULL OR e.created_at >= p_from_date::timestamptz)
         AND (p_to_date IS NULL OR e.created_at < (p_to_date + 1)::timestamptz)
         AND (p_gestione_filter IS NULL OR e.props->>'gestione' = p_gestione_filter)
         AND (p_wizard_variant IS NULL OR COALESCE(e.props->>'variant', 'control') = p_wizard_variant)
      ) AS total_started,
      (SELECT COUNT(DISTINCT e.user_id) FROM event_logs e JOIN valid_users v ON v.user_id = e.user_id
       WHERE e.event_name = 'wizard_completed'
         AND (p_from_date IS NULL OR e.created_at >= p_from_date::timestamptz)
         AND (p_to_date IS NULL OR e.created_at < (p_to_date + 1)::timestamptz)
         AND (p_gestione_filter IS NULL OR e.props->>'gestione' = p_gestione_filter)
         AND (p_wizard_variant IS NULL OR COALESCE(e.props->>'variant', 'control') = p_wizard_variant)
      ) AS total_completed
  ),
  top_drop_off AS (
    SELECT f.step_id
    FROM funnel f
    WHERE f.entered >= 3 AND f.drop_off_rate > 0
    ORDER BY f.drop_off_rate DESC
    LIMIT 1
  ),
  summary_json AS (
    SELECT json_build_object(
      'total_started', sd.total_started,
      'total_completed', sd.total_completed,
      'overall_completion_rate', CASE
        WHEN sd.total_started = 0 THEN 0
        ELSE ROUND(sd.total_completed::NUMERIC / sd.total_started * 100, 1)
      END,
      'top_drop_off_step', tdo.step_id
    ) AS val
    FROM summary_data sd
    LEFT JOIN top_drop_off tdo ON true
  )
  SELECT json_build_object(
    'funnel', fj.val,
    'time_per_step', tj.val,
    'abandonment', aj.val,
    'summary', sj.val
  )
  INTO result
  FROM funnel_json fj, time_json tj, abandonment_json aj, summary_json sj;

  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.get_wizard_funnel(DATE, DATE, TEXT);
GRANT EXECUTE ON FUNCTION public.get_wizard_funnel(DATE, DATE, TEXT, TEXT) TO authenticated;

-- 3. get_ttv_dashboard — aggiunta p_wizard_variant
CREATE OR REPLACE FUNCTION public.get_ttv_dashboard(
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_trend_days INTEGER DEFAULT 30,
  p_wizard_variant TEXT DEFAULT NULL
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
      AND (p_wizard_variant IS NULL OR COALESCE(p.wizard_variant, 'control') = p_wizard_variant)
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
      AND (p_wizard_variant IS NULL OR COALESCE(p.wizard_variant, 'control') = p_wizard_variant)
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

DROP FUNCTION IF EXISTS public.get_ttv_dashboard(DATE, DATE, INTEGER);
GRANT EXECUTE ON FUNCTION public.get_ttv_dashboard(DATE, DATE, INTEGER, TEXT) TO authenticated;

-- 4. get_ab_test_comparison — nuova RPC confronto A/B
CREATE OR REPLACE FUNCTION public.get_ab_test_comparison(
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL
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

  WITH variant_users AS (
    SELECT
      p.user_id,
      COALESCE(p.wizard_variant, 'control') AS variant_name
    FROM profiles p
    WHERE p.is_internal IS NOT TRUE
      AND (p_from_date IS NULL OR p.created_at >= p_from_date::timestamptz)
      AND (p_to_date IS NULL OR p.created_at < (p_to_date + 1)::timestamptz)
  ),
  started AS (
    SELECT DISTINCT vu.variant_name, e.user_id
    FROM event_logs e
    JOIN variant_users vu ON vu.user_id = e.user_id
    WHERE e.event_name = 'wizard_step_entered'
  ),
  completed AS (
    SELECT DISTINCT vu.variant_name, e.user_id,
      (e.props->>'total_time_seconds')::NUMERIC AS completion_seconds
    FROM event_logs e
    JOIN variant_users vu ON vu.user_id = e.user_id
    WHERE e.event_name = 'wizard_completed'
  ),
  user_ttv AS (
    SELECT
      vu.variant_name,
      vu.user_id,
      EXTRACT(EPOCH FROM (MIN(r.created_at) - p.created_at)) / 60.0 AS ttv_minutes
    FROM variant_users vu
    JOIN profiles p ON p.user_id = vu.user_id
    JOIN receipts r ON r.user_id = vu.user_id
    WHERE p.onboarding_completed = true
    GROUP BY vu.variant_name, vu.user_id, p.created_at
    HAVING EXTRACT(EPOCH FROM (MIN(r.created_at) - p.created_at)) >= 0
  ),
  per_variant AS (
    SELECT
      s.variant_name,
      COUNT(DISTINCT s.user_id)::BIGINT AS total_started,
      COUNT(DISTINCT c.user_id)::BIGINT AS total_completed,
      CASE WHEN COUNT(DISTINCT s.user_id) = 0 THEN 0
        ELSE ROUND(COUNT(DISTINCT c.user_id)::NUMERIC / COUNT(DISTINCT s.user_id) * 100, 1)
      END AS completion_rate,
      ROUND(COALESCE(
        percentile_cont(0.5) WITHIN GROUP (ORDER BY c.completion_seconds), 0
      )::NUMERIC, 1) AS median_completion_seconds,
      COUNT(DISTINCT s.user_id)::BIGINT AS sample_size
    FROM started s
    LEFT JOIN completed c ON c.user_id = s.user_id AND c.variant_name = s.variant_name
    GROUP BY s.variant_name
  ),
  ttv_per_variant AS (
    SELECT
      variant_name,
      ROUND(COALESCE(
        percentile_cont(0.5) WITHIN GROUP (ORDER BY ttv_minutes), 0
      )::NUMERIC, 1) AS median_ttv_minutes
    FROM user_ttv
    GROUP BY variant_name
  ),
  combined AS (
    SELECT
      pv.variant_name,
      pv.total_started,
      pv.total_completed,
      pv.completion_rate,
      pv.median_completion_seconds,
      COALESCE(tv.median_ttv_minutes, 0) AS median_ttv_minutes,
      pv.sample_size
    FROM per_variant pv
    LEFT JOIN ttv_per_variant tv ON tv.variant_name = pv.variant_name
  ),
  variants_json AS (
    SELECT COALESCE(json_agg(
      json_build_object(
        'variant_name', c.variant_name,
        'total_started', c.total_started,
        'total_completed', c.total_completed,
        'completion_rate', c.completion_rate,
        'median_completion_seconds', c.median_completion_seconds,
        'median_ttv_minutes', c.median_ttv_minutes,
        'sample_size', c.sample_size
      )
    ), '[]'::json) AS val
    FROM combined c
  ),
  z_test AS (
    SELECT
      c1.completion_rate AS p1,
      c2.completion_rate AS p2,
      c1.total_completed AS x1,
      c2.total_completed AS x2,
      c1.sample_size AS n1,
      c2.sample_size AS n2,
      CASE
        WHEN (c1.sample_size + c2.sample_size) = 0 THEN 0
        ELSE (c1.total_completed + c2.total_completed)::NUMERIC / (c1.sample_size + c2.sample_size)
      END AS p_pool
    FROM combined c1, combined c2
    WHERE c1.variant_name = 'control' AND c2.variant_name = 'short'
  ),
  z_result AS (
    SELECT
      CASE
        WHEN z.n1 < 2 OR z.n2 < 2 OR z.p_pool = 0 OR z.p_pool = 1 THEN 0
        ELSE ROUND((
          (z.p1 / 100.0 - z.p2 / 100.0) /
          NULLIF(SQRT(z.p_pool * (1 - z.p_pool) * (1.0 / z.n1 + 1.0 / z.n2)), 0)
        )::NUMERIC, 4)
      END AS z_score,
      z.n1 + z.n2 AS total_sample
    FROM z_test z
  )
  SELECT json_build_object(
    'variants', vj.val,
    'z_score', COALESCE(zr.z_score, 0),
    'is_significant', COALESCE(ABS(zr.z_score) > 1.96, false),
    'total_sample', COALESCE(zr.total_sample, 0)
  )
  INTO result
  FROM variants_json vj
  LEFT JOIN z_result zr ON true;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ab_test_comparison(DATE, DATE) TO authenticated;