-- ============================================================================
-- Hot-fix NSM: default window 60 -> 90gg (seguito Story 75-2c).
-- Data: 2026-04-18
--
-- Motivazione: la finestra 60gg lasciava sistematicamente fuori il bucket
-- monolitico 'june' della gestione separata (scadenza 30/06 = ~73gg da aprile),
-- rendendo tutti gli utenti separata "trivially covered" nei mesi aprile-metà
-- maggio. Il breakdown per scadenza mostrava quindi SOLO i bucket tipizzati
-- di artigiani/commercianti (inps_q1..q4, acconto_tax_1/2, acconto_inps_1/2),
-- con la gestione separata invisibile. 90gg copre june gia' dal 1° aprile e
-- november dal 2° agosto, dando parita' di trattamento alle 3 gestioni.
--
-- Nessuna modifica alla logica CTE: il corpo della funzione e' identico a
-- 20260418120000_refactor_nsm_wcaf.sql, cambia SOLO il DEFAULT del parametro
-- p_window_days (60 -> 90). Chiamanti che passano esplicitamente window_days
-- non sono impattati.
--
-- PostgreSQL non supporta ALTER FUNCTION ... ALTER DEFAULT, quindi serve
-- CREATE OR REPLACE. Il corpo e' copia letterale (nessun refactor logico) per
-- ridurre superficie di review: diff significativa solo sulla riga 3 (DEFAULT).
--
-- Rollback: re-applicare 20260418120000_refactor_nsm_wcaf.sql.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_nsm_scadenze_coperte(
  p_reference_date DATE DEFAULT CURRENT_DATE,
  p_window_days INTEGER DEFAULT 90,   -- <-- era 60 in 75-2c
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
  -- Admin gate
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  -- Validazione input
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
     AND p_gestione_filter NOT IN ('separata', 'artigiani', 'commercianti') THEN
    RAISE EXCEPTION 'Invalid gestione_filter: % (allowed: separata|artigiani|commercianti)', p_gestione_filter;
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
      ORDER BY
        CASE WHEN f.fiscal_year = v_fiscal_year THEN 0 ELSE 1 END,
        f.fiscal_year DESC
      LIMIT 1
    ) fys ON true
    WHERE p.is_internal IS NOT TRUE
      AND p.onboarding_completed = true
      AND EXISTS (
        SELECT 1
        FROM public.receipts r
        WHERE r.user_id = p.user_id
          AND r.receipt_date >= (p_reference_date - INTERVAL '90 days')::DATE
          AND r.receipt_date <= p_reference_date
      )
      AND (p_gestione_filter IS NULL OR fys.inps_management = p_gestione_filter)
  ),

  deadlines_in_window AS (
    SELECT ts.user_id, ts.bucket, ts.due_date,
      (ts.total_expected - ts.total_paid) AS residuo
    FROM public.tax_schedule ts
    JOIN valid_users v ON v.user_id = ts.user_id
    WHERE ts.status != 'paid'
      AND ts.due_date >= p_reference_date
      AND ts.due_date <= p_reference_date + p_window_days
      AND (ts.total_expected - ts.total_paid) > 0
  ),

  user_residui AS (
    SELECT user_id, SUM(residuo) AS total_residuo
    FROM deadlines_in_window
    GROUP BY user_id
  ),

  active_coverage AS (
    SELECT
      ur.user_id,
      ur.total_residuo,
      public._calc_totale_accantonamento(ur.user_id, v_fiscal_year) AS accantonamento
    FROM user_residui ur
  ),

  active_coverage_flagged AS (
    SELECT user_id, total_residuo, accantonamento,
      (accantonamento >= total_residuo) AS covered
    FROM active_coverage
    WHERE accantonamento IS NOT NULL
  ),

  trivially_covered_users AS (
    SELECT v.user_id
    FROM valid_users v
    WHERE NOT EXISTS (
      SELECT 1 FROM deadlines_in_window d WHERE d.user_id = v.user_id
    )
  ),

  bucket_coverage AS (
    SELECT fd.bucket, acf.user_id, acf.covered
    FROM deadlines_in_window fd
    JOIN active_coverage_flagged acf ON acf.user_id = fd.user_id
  ),
  by_bucket_agg AS (
    SELECT
      bucket,
      COUNT(DISTINCT user_id)::BIGINT AS observed,
      COUNT(DISTINCT user_id) FILTER (WHERE covered = true)::BIGINT AS covered
    FROM bucket_coverage
    GROUP BY bucket
  ),
  by_bucket_json AS (
    SELECT COALESCE(json_agg(
      json_build_object(
        'bucket', bucket,
        'covered', covered,
        'observed', observed,
        'percent', ROUND(covered * 100.0 / NULLIF(observed, 0), 1)
      )
      ORDER BY observed DESC, bucket ASC
    ), '[]'::json) AS val
    FROM by_bucket_agg
  ),

  active_totals AS (
    SELECT
      COUNT(*)::BIGINT AS active_total,
      COUNT(*) FILTER (WHERE covered = true)::BIGINT AS active_covered
    FROM active_coverage_flagged
  ),
  totals AS (
    SELECT
      at.active_total,
      at.active_covered,
      (SELECT COUNT(*)::BIGINT FROM trivially_covered_users) AS trivial_count
    FROM active_totals at
  )
  SELECT json_build_object(
    'nsm_percent', CASE
      WHEN (t.active_total + t.trivial_count) = 0 THEN NULL
      ELSE ROUND(
        (t.active_covered + t.trivial_count) * 100.0
        / NULLIF(t.active_total + t.trivial_count, 0),
        1
      )
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
  INTO result
  FROM totals t, by_bucket_json bj;

  -- Invariants WCAF (defense-in-depth, invariato vs 75-2c).
  IF (result->>'active_covered_count')::BIGINT > (result->>'total_observed')::BIGINT THEN
    RAISE EXCEPTION 'NSM invariant broken: active_covered_count (%) > total_observed (%)',
      result->>'active_covered_count', result->>'total_observed';
  END IF;

  IF (result->>'covered_count')::BIGINT
     <> ((result->>'active_covered_count')::BIGINT + (result->>'trivially_covered_count')::BIGINT) THEN
    RAISE EXCEPTION 'NSM invariant broken: covered_count (%) != active_covered + trivial (% + %)',
      result->>'covered_count',
      result->>'active_covered_count',
      result->>'trivially_covered_count';
  END IF;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_nsm_scadenze_coperte(DATE, INTEGER, TEXT) IS
  'North Star Metric WCAF (default window 90gg, hot-fix 2026-04-18 seguito 75-2c): % utenti WCAF-eligible (non-internal, onboarding, >=1 incasso ultimi 90gg) con accantonamento >= SUM(residui scadenze non pagate in finestra), OR nessuna scadenza in finestra (trivialmente coperto). Il passaggio 60->90gg rende visibile la gestione separata (bucket june/november monolitici) nel breakdown. Admin-only.';

GRANT EXECUTE ON FUNCTION public.get_nsm_scadenze_coperte(DATE, INTEGER, TEXT) TO authenticated;
