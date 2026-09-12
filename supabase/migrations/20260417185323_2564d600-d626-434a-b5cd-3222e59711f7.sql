-- Story 75-2a: NSM Calculation RPC "Scadenze Coperte Senza Sorpresa"

CREATE INDEX IF NOT EXISTS idx_tax_schedule_user_due_open
  ON public.tax_schedule (user_id, due_date)
  WHERE status != 'paid';

CREATE OR REPLACE FUNCTION public._calc_totale_accantonamento(
  p_user_id UUID,
  p_fiscal_year INTEGER
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_incassi_ytd          NUMERIC := 0;
  v_profit_coefficient   NUMERIC;
  v_tax_rate             NUMERIC;
  v_inps_management      TEXT;
  v_riduzione_35         BOOLEAN;
  v_riduzione_50         BOOLEAN;
  v_aliquota             NUMERIC;
  v_inps_rate_sep        NUMERIC;
  v_massimale_sep        NUMERIC;
  v_inps_rate_art        NUMERIC;
  v_inps_rate_art_alta   NUMERIC;
  v_minimale_art         NUMERIC;
  v_massimale_art        NUMERIC;
  v_inps_rate_comm       NUMERIC;
  v_inps_rate_comm_alta  NUMERIC;
  v_minimale_comm        NUMERIC;
  v_massimale_comm       NUMERIC;
  v_reddito_minimale     NUMERIC;
  v_soglia_prima_fascia  NUMERIC;
  v_maternita            NUMERIC;
  v_aliq_5               NUMERIC;
  v_aliq_15              NUMERIC;
  v_imponibile           NUMERIC;
  v_contributi           NUMERIC;
  v_minimale_effettivo   NUMERIC;
  v_minimale_ivs         NUMERIC;
  v_variabile            NUMERIC;
  v_base_var             NUMERIC;
  v_eccedenza            NUMERIC;
  v_fascia1_limit        NUMERIC;
  v_fascia1              NUMERIC;
  v_fascia2              NUMERIC;
  v_imponibile_netto     NUMERIC;
  v_imposta              NUMERIC;
  v_inps_rate_art_eff    NUMERIC;
  v_inps_rate_comm_eff   NUMERIC;
BEGIN
  SELECT fys.profit_coefficient, fys.tax_rate, fys.inps_management,
    COALESCE(fys.riduzione_35_attiva, false), COALESCE(fys.riduzione_50_attiva, false)
  INTO v_profit_coefficient, v_tax_rate, v_inps_management, v_riduzione_35, v_riduzione_50
  FROM public.fiscal_year_settings fys
  WHERE fys.user_id = p_user_id AND fys.fiscal_year = p_fiscal_year
  LIMIT 1;

  IF v_inps_management IS NULL THEN
    SELECT fys.profit_coefficient, fys.tax_rate, fys.inps_management,
      COALESCE(fys.riduzione_35_attiva, false), COALESCE(fys.riduzione_50_attiva, false)
    INTO v_profit_coefficient, v_tax_rate, v_inps_management, v_riduzione_35, v_riduzione_50
    FROM public.fiscal_year_settings fys
    WHERE fys.user_id = p_user_id
    ORDER BY fys.fiscal_year DESC LIMIT 1;
  END IF;

  IF v_inps_management IS NULL THEN RETURN NULL; END IF;
  IF v_profit_coefficient IS NULL OR v_tax_rate IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(SUM(r.gross_amount), 0) INTO v_incassi_ytd
  FROM public.receipts r
  WHERE r.user_id = p_user_id AND r.fiscal_year = p_fiscal_year;

  SELECT fr.inps_rate_separata, fr.massimale_separata, fr.inps_rate_artigiani,
    fr.inps_rate_artigiani_alta, fr.minimale_artigiani, fr.massimale_artigiani,
    fr.inps_rate_commercianti, fr.inps_rate_commercianti_alta, fr.minimale_commercianti,
    fr.massimale_commercianti, fr.reddito_minimale, fr.soglia_reddito_prima_fascia,
    fr.maternita_annuale, fr.aliquota_sostitutiva_5, fr.aliquota_sostitutiva_15
  INTO v_inps_rate_sep, v_massimale_sep, v_inps_rate_art, v_inps_rate_art_alta,
    v_minimale_art, v_massimale_art, v_inps_rate_comm, v_inps_rate_comm_alta,
    v_minimale_comm, v_massimale_comm, v_reddito_minimale, v_soglia_prima_fascia,
    v_maternita, v_aliq_5, v_aliq_15
  FROM public.fiscal_rules fr WHERE fr.fiscal_year = p_fiscal_year LIMIT 1;

  IF v_inps_rate_sep IS NULL THEN RETURN NULL; END IF;

  v_aliquota := CASE WHEN v_tax_rate <= 5 THEN v_aliq_5 ELSE v_aliq_15 END;
  v_imponibile := ROUND(v_incassi_ytd * v_profit_coefficient / 100, 2);

  IF v_inps_management = 'separata' THEN
    v_contributi := CASE WHEN v_massimale_sep > 0 THEN LEAST(v_imponibile, v_massimale_sep) ELSE v_imponibile END;
    v_contributi := ROUND(v_contributi * v_inps_rate_sep / 100, 2);
  ELSIF v_inps_management IN ('artigiani', 'commercianti') THEN
    IF v_inps_management = 'artigiani' THEN v_minimale_effettivo := v_minimale_art;
    ELSE v_minimale_effettivo := v_minimale_comm; END IF;

    IF v_riduzione_50 THEN
      v_minimale_ivs := v_minimale_effettivo - v_maternita;
      v_minimale_effettivo := ROUND(v_minimale_ivs * 0.5, 2) + v_maternita;
    ELSIF v_riduzione_35 THEN
      v_minimale_effettivo := ROUND(v_minimale_effettivo * 0.65, 2);
    END IF;

    IF v_inps_management = 'artigiani' THEN
      v_base_var := CASE WHEN v_massimale_art > 0 THEN LEAST(v_imponibile, v_massimale_art) ELSE v_imponibile END;
    ELSE
      v_base_var := CASE WHEN v_massimale_comm > 0 THEN LEAST(v_imponibile, v_massimale_comm) ELSE v_imponibile END;
    END IF;

    v_eccedenza := GREATEST(0, v_base_var - v_reddito_minimale);

    IF v_eccedenza > 0 THEN
      v_fascia1_limit := v_soglia_prima_fascia - v_reddito_minimale;
      IF v_inps_management = 'artigiani' THEN
        v_fascia1 := ROUND(LEAST(v_eccedenza, v_fascia1_limit) * v_inps_rate_art / 100, 2);
        v_fascia2 := ROUND(GREATEST(0, v_base_var - v_soglia_prima_fascia) * v_inps_rate_art_alta / 100, 2);
      ELSE
        v_fascia1 := ROUND(LEAST(v_eccedenza, v_fascia1_limit) * v_inps_rate_comm / 100, 2);
        v_fascia2 := ROUND(GREATEST(0, v_base_var - v_soglia_prima_fascia) * v_inps_rate_comm_alta / 100, 2);
      END IF;
      v_variabile := v_fascia1 + v_fascia2;
      IF v_riduzione_50 THEN v_variabile := ROUND(v_variabile * 0.5, 2);
      ELSIF v_riduzione_35 THEN v_variabile := ROUND(v_variabile * 0.65, 2); END IF;
    ELSE v_variabile := 0; END IF;

    v_contributi := v_minimale_effettivo + v_variabile;
  ELSE RETURN NULL; END IF;

  v_imponibile_netto := GREATEST(0, v_imponibile - v_contributi);
  v_imposta := ROUND(v_imponibile_netto * v_aliquota / 100, 2);
  RETURN ROUND(v_contributi + v_imposta, 2);
END;
$$;

REVOKE ALL ON FUNCTION public._calc_totale_accantonamento(UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._calc_totale_accantonamento(UUID, INTEGER) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_nsm_scadenze_coperte(
  p_reference_date DATE DEFAULT CURRENT_DATE,
  p_window_days INTEGER DEFAULT 7,
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
     AND p_gestione_filter NOT IN ('separata', 'artigiani', 'commercianti') THEN
    RAISE EXCEPTION 'Invalid gestione_filter: %', p_gestione_filter;
  END IF;

  v_fiscal_year := EXTRACT(YEAR FROM p_reference_date)::INTEGER;

  WITH valid_users AS (
    SELECT p.user_id FROM public.profiles p
    WHERE p.is_internal IS NOT TRUE AND p.onboarding_completed = true
  ),
  next_deadline AS (
    SELECT DISTINCT ON (ts.user_id)
      ts.user_id, ts.bucket, ts.due_date,
      (ts.total_expected - ts.total_paid) AS residuo
    FROM public.tax_schedule ts
    JOIN valid_users v ON v.user_id = ts.user_id
    WHERE ts.status != 'paid'
      AND ts.due_date >= p_reference_date
      AND ts.due_date <= p_reference_date + p_window_days
      AND (ts.total_expected - ts.total_paid) > 0
    ORDER BY ts.user_id, ts.due_date ASC, ts.id ASC
  ),
  observed AS (
    SELECT nd.user_id, nd.bucket, nd.due_date, nd.residuo, fys.inps_management
    FROM next_deadline nd
    JOIN LATERAL (
      SELECT f.inps_management FROM public.fiscal_year_settings f
      WHERE f.user_id = nd.user_id
      ORDER BY CASE WHEN f.fiscal_year = v_fiscal_year THEN 0 ELSE 1 END, f.fiscal_year DESC
      LIMIT 1
    ) fys ON true
    WHERE p_gestione_filter IS NULL OR fys.inps_management = p_gestione_filter
  ),
  coverage AS (
    SELECT o.user_id, o.bucket, o.residuo,
      public._calc_totale_accantonamento(o.user_id, v_fiscal_year) AS accantonamento
    FROM observed o
  ),
  coverage_flagged AS (
    SELECT c.user_id, c.bucket, c.residuo, c.accantonamento,
      (c.accantonamento >= c.residuo) AS covered
    FROM coverage c WHERE c.accantonamento IS NOT NULL
  ),
  totals AS (
    SELECT COUNT(*)::BIGINT AS total_observed,
      COUNT(*) FILTER (WHERE covered = true)::BIGINT AS covered_count,
      COUNT(*) FILTER (WHERE covered = false)::BIGINT AS uncovered_count
    FROM coverage_flagged
  ),
  by_bucket_agg AS (
    SELECT bucket, COUNT(*)::BIGINT AS observed,
      COUNT(*) FILTER (WHERE covered = true)::BIGINT AS covered
    FROM coverage_flagged GROUP BY bucket
  ),
  by_bucket_json AS (
    SELECT COALESCE(json_agg(
      json_build_object(
        'bucket', b.bucket, 'covered', b.covered, 'observed', b.observed,
        'percent', ROUND(b.covered * 100.0 / NULLIF(b.observed, 0), 1)
      ) ORDER BY b.observed DESC, b.bucket ASC
    ), '[]'::json) AS val
    FROM by_bucket_agg b
  )
  SELECT json_build_object(
    'nsm_percent', CASE WHEN t.total_observed = 0 THEN NULL
      ELSE ROUND(t.covered_count * 100.0 / NULLIF(t.total_observed, 0), 1) END,
    'covered_count', t.covered_count,
    'uncovered_count', t.uncovered_count,
    'total_observed', t.total_observed,
    'reference_date', p_reference_date,
    'window_days', p_window_days,
    'gestione_filter', p_gestione_filter,
    'by_bucket', bj.val
  ) INTO result FROM totals t, by_bucket_json bj;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nsm_scadenze_coperte(DATE, INTEGER, TEXT) TO authenticated;