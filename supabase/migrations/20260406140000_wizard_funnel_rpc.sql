-- Story 70-3: Wizard Funnel Dashboard RPC
-- Calcola funnel step-by-step del wizard con drop-off rate, tempo medio per step
-- e distribuzione abbandoni. Ritorna JSON composito in 1 round-trip.

-- Future optimization (>200k events):
-- CREATE INDEX idx_event_logs_wizard ON event_logs(event_name) WHERE event_name LIKE 'wizard_%';

CREATE OR REPLACE FUNCTION public.get_wizard_funnel(
  p_from_date DATE DEFAULT NULL,
  p_to_date DATE DEFAULT NULL,
  p_gestione_filter TEXT DEFAULT NULL
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
  -- Admin check
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  -- S1: validazione input gestione filter
  IF p_gestione_filter IS NOT NULL AND p_gestione_filter NOT IN ('separata', 'artigiani', 'commercianti') THEN
    RAISE EXCEPTION 'Invalid gestione filter: %', p_gestione_filter;
  END IF;

  WITH valid_users AS (
    SELECT user_id FROM profiles WHERE is_internal IS NOT TRUE
  ),
  -- Conta utenti unici che sono entrati in ogni step
  step_entered AS (
    SELECT e.props->>'step_id' AS step_id, COUNT(DISTINCT e.user_id) AS cnt
    FROM event_logs e
    JOIN valid_users v ON v.user_id = e.user_id
    WHERE e.event_name = 'wizard_step_entered'
      AND (p_from_date IS NULL OR e.created_at >= p_from_date::timestamptz)
      AND (p_to_date IS NULL OR e.created_at < (p_to_date + 1)::timestamptz)
      AND (p_gestione_filter IS NULL OR e.props->>'gestione' = p_gestione_filter)
    GROUP BY e.props->>'step_id'
  ),
  -- Conta utenti unici che hanno completato ogni step
  step_completed AS (
    SELECT e.props->>'step_id' AS step_id, COUNT(DISTINCT e.user_id) AS cnt
    FROM event_logs e
    JOIN valid_users v ON v.user_id = e.user_id
    WHERE e.event_name = 'wizard_step_completed'
      AND (p_from_date IS NULL OR e.created_at >= p_from_date::timestamptz)
      AND (p_to_date IS NULL OR e.created_at < (p_to_date + 1)::timestamptz)
      AND (p_gestione_filter IS NULL OR e.props->>'gestione' = p_gestione_filter)
    GROUP BY e.props->>'step_id'
  ),
  -- ADR-4: ritorna SEMPRE tutti i 9 step, il frontend nasconde entered=0 sotto filtro gestione
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
  -- Tempo medio, mediana e p90 per step (da wizard_step_completed con time_spent_seconds)
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
  -- Distribuzione abbandoni: da wizard_abandoned, conta per last_step_id
  abandoned_total AS (
    SELECT COUNT(DISTINCT e.user_id) AS total
    FROM event_logs e
    JOIN valid_users v ON v.user_id = e.user_id
    WHERE e.event_name = 'wizard_abandoned'
      AND (p_from_date IS NULL OR e.created_at >= p_from_date::timestamptz)
      AND (p_to_date IS NULL OR e.created_at < (p_to_date + 1)::timestamptz)
      AND (p_gestione_filter IS NULL OR e.props->>'gestione' = p_gestione_filter)
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
  -- Summary: totali e step piu' problematico
  summary_data AS (
    SELECT
      (SELECT COUNT(DISTINCT e.user_id) FROM event_logs e JOIN valid_users v ON v.user_id = e.user_id
       WHERE e.event_name = 'wizard_step_entered'
         AND (p_from_date IS NULL OR e.created_at >= p_from_date::timestamptz)
         AND (p_to_date IS NULL OR e.created_at < (p_to_date + 1)::timestamptz)
         AND (p_gestione_filter IS NULL OR e.props->>'gestione' = p_gestione_filter)
      ) AS total_started,
      (SELECT COUNT(DISTINCT e.user_id) FROM event_logs e JOIN valid_users v ON v.user_id = e.user_id
       WHERE e.event_name = 'wizard_completed'
         AND (p_from_date IS NULL OR e.created_at >= p_from_date::timestamptz)
         AND (p_to_date IS NULL OR e.created_at < (p_to_date + 1)::timestamptz)
         AND (p_gestione_filter IS NULL OR e.props->>'gestione' = p_gestione_filter)
      ) AS total_completed
  ),
  -- ADR-5: soglia entered >= 3 per top_drop_off_step
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

GRANT EXECUTE ON FUNCTION public.get_wizard_funnel(DATE, DATE, TEXT) TO authenticated;
