CREATE OR REPLACE FUNCTION public.get_nsm_scadenze_coperte(
  p_reference_date DATE DEFAULT CURRENT_DATE,
  p_window_days INTEGER DEFAULT 90,
  p_gestione_filter TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  v_fiscal_year INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;
  IF p_window_days IS NULL OR p_window_days <= 0 THEN
    RAISE EXCEPTION 'Invalid window_days: must be positive (received %)', p_window_days;
  END IF;
  IF p_reference_date > CURRENT_DATE + 365 THEN
    RAISE EXCEPTION 'reference_date too far in the future (>365gg): %', p_reference_date;
  END IF;
  IF p_reference_date < CURRENT_DATE - 1095 THEN
    RAISE EXCEPTION 'reference_date too far in the past (>3 anni): %', p_reference_date;
  END IF;
  IF p_gestione_filter IS NOT NULL
     AND p_gestione_filter NOT IN ('separata', 'artigiani', 'commercianti', 'art_comm') THEN
    RAISE EXCEPTION 'Invalid gestione_filter: % (allowed: separata|artigiani|commercianti|art_comm)', p_gestione_filter;
  END IF;

  v_fiscal_year := EXTRACT(YEAR FROM p_reference_date)::INTEGER;

  WITH
  valid_users AS (
    SELECT p.user_id, fys.inps_management
    FROM public.profiles p
    JOIN LATERAL (
      SELECT f.inps_management
      FROM public.fiscal_year_settings f
      WHERE f.user_id = p.user_id
      ORDER BY CASE WHEN f.fiscal_year = v_fiscal_year THEN 0 ELSE 1 END, f.fiscal_year DESC
      LIMIT 1
    ) fys ON true
    WHERE p.is_internal IS NOT TRUE
      AND p.onboarding_completed = true
      AND EXISTS (
        SELECT 1 FROM public.receipts r
        WHERE r.user_id = p.user_id
          AND r.receipt_date >= (p_reference_date - INTERVAL '90 days')::DATE
          AND r.receipt_date <= p_reference_date
      )
      AND (
        p_gestione_filter IS NULL
        OR fys.inps_management = p_gestione_filter
        OR (p_gestione_filter = 'art_comm' AND fys.inps_management IN ('artigiani', 'commercianti'))
      )
  ),
  deadlines_in_window AS (
    SELECT ts.user_id, ts.bucket, ts.due_date, (ts.total_expected - ts.total_paid) AS residuo
    FROM public.tax_schedule ts
    JOIN valid_users v ON v.user_id = ts.user_id
    WHERE ts.status != 'paid'
      AND ts.due_date >= p_reference_date
      AND ts.due_date <= p_reference_date + p_window_days
      AND (ts.total_expected - ts.total_paid) > 0
  ),
  user_residui AS (
    SELECT user_id, SUM(residuo) AS total_residuo FROM deadlines_in_window GROUP BY user_id
  ),
  active_coverage AS (
    SELECT ur.user_id, ur.total_residuo,
      public._calc_totale_accantonamento(ur.user_id, v_fiscal_year) AS accantonamento
    FROM user_residui ur
  ),
  active_coverage_flagged AS (
    SELECT user_id, total_residuo, accantonamento, (accantonamento >= total_residuo) AS covered
    FROM active_coverage WHERE accantonamento IS NOT NULL
  ),
  trivially_covered_users AS (
    SELECT v.user_id FROM valid_users v
    WHERE NOT EXISTS (SELECT 1 FROM deadlines_in_window d WHERE d.user_id = v.user_id)
  ),
  bucket_coverage AS (
    SELECT fd.bucket, acf.user_id, acf.covered
    FROM deadlines_in_window fd JOIN active_coverage_flagged acf ON acf.user_id = fd.user_id
  ),
  by_bucket_agg AS (
    SELECT bucket,
      COUNT(DISTINCT user_id)::BIGINT AS observed,
      COUNT(DISTINCT user_id) FILTER (WHERE covered = true)::BIGINT AS covered
    FROM bucket_coverage GROUP BY bucket
  ),
  by_bucket_json AS (
    SELECT COALESCE(json_agg(
      json_build_object(
        'bucket', bucket, 'covered', covered, 'observed', observed,
        'percent', ROUND(covered * 100.0 / NULLIF(observed, 0), 1)
      ) ORDER BY observed DESC, bucket ASC
    ), '[]'::json) AS val FROM by_bucket_agg
  ),
  active_totals AS (
    SELECT COUNT(*)::BIGINT AS active_total,
      COUNT(*) FILTER (WHERE covered = true)::BIGINT AS active_covered
    FROM active_coverage_flagged
  ),
  totals AS (
    SELECT at.active_total, at.active_covered,
      (SELECT COUNT(*)::BIGINT FROM trivially_covered_users) AS trivial_count
    FROM active_totals at
  )
  SELECT json_build_object(
    'nsm_percent', CASE
      WHEN (t.active_total + t.trivial_count) = 0 THEN NULL
      ELSE ROUND((t.active_covered + t.trivial_count) * 100.0
        / NULLIF(t.active_total + t.trivial_count, 0), 1)
    END,
    'covered_count', t.active_covered + t.trivial_count,
    'uncovered_count', t.active_total - t.active_covered,
    'total_observed', t.active_total + t.trivial_count,
    'active_covered_count', t.active_covered,
    'trivially_covered_count', t.trivial_count,
    'reference_date', p_reference_date,
    'window_days', p_window_days,
    'gestione_filter', p_gestione_filter,
    'by_bucket', bj.val
  )
  INTO result FROM totals t, by_bucket_json bj;

  IF (result->>'active_covered_count')::BIGINT > (result->>'total_observed')::BIGINT THEN
    RAISE EXCEPTION 'NSM invariant broken: active_covered_count (%) > total_observed (%)',
      result->>'active_covered_count', result->>'total_observed';
  END IF;
  IF (result->>'covered_count')::BIGINT
     <> ((result->>'active_covered_count')::BIGINT + (result->>'trivially_covered_count')::BIGINT) THEN
    RAISE EXCEPTION 'NSM invariant broken: covered_count (%) != active_covered + trivial (% + %)',
      result->>'covered_count', result->>'active_covered_count', result->>'trivially_covered_count';
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nsm_scadenze_coperte(DATE, INTEGER, TEXT) TO authenticated;