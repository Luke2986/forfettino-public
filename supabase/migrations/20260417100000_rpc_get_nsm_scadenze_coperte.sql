-- ============================================================================
-- Story 75-2a: NSM Calculation RPC "Scadenze Coperte Senza Sorpresa"
-- Epic 75: Activation Framework & NSM Dashboard
-- Data: 2026-04-17
--
-- Obiettivo: calcolare real-time la North Star Metric "% utenti con
-- accantonamento fiscale >= importo residuo della prossima scadenza nella
-- finestra [reference_date, reference_date + window_days]" (prospettica: le
-- scadenze che cadono entro N giorni da oggi). Denominatore = utenti con
-- scadenza non pagata in finestra (chi non ha scadenze imminenti NON entra
-- nei conteggi). Numeratore = utenti il cui totaleAccantonamento (imposta +
-- contributi INPS secondo la formula di src/lib/fiscal-engine.ts) copre il
-- residuo.
--
-- Formula accantonamento replicata da:
--   - src/lib/fiscal-engine.ts :: calcTotaleMultiGestione (pipeline completa)
--   - calcINPSSeparata / calcINPSArtigiani / calcINPSCommercianti (dispatcher)
--   - calcImpostaConDeducibilita (base imponibile sostitutiva dedotta INPS)
-- Deve restare coerente al centesimo con il totaleAccantonamento mostrato
-- sulla dashboard utente.
--
-- Pattern RPC: stesso stile di get_ttv_dashboard (Story 70-2) e
-- get_wizard_funnel (Story 70-3). JSON composito in una round-trip.
--
-- Performance: on-demand, no materialized view. Target < 1s con 1.000
-- utenti. Quando runtime > 2s (espansione post-lancio), migrare a snapshot
-- notturno.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Indice partial per accelerare la ricerca scadenze aperte in finestra
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tax_schedule_user_due_open
  ON public.tax_schedule (user_id, due_date)
  WHERE status != 'paid';

-- ----------------------------------------------------------------------------
-- 2. Helper privato: calcola totaleAccantonamento (EUR) per singolo utente
--    Ritorna NULL se mancano settings o fiscal_rules (utente non calcolabile,
--    sara' escluso dal denominatore NSM).
--    Private per convenzione (prefisso underscore). Puo' essere riusato da
--    storie successive di Epic 75 (75-3, 75-4).
-- ----------------------------------------------------------------------------
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

  -- Parametri da fiscal_rules
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

  -- Valori calcolati
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
  -- Load settings utente per l'anno fiscale richiesto (fallback: ultimo anno
  -- disponibile se non esiste riga per p_fiscal_year)
  SELECT
    fys.profit_coefficient,
    fys.tax_rate,
    fys.inps_management,
    COALESCE(fys.riduzione_35_attiva, false),
    COALESCE(fys.riduzione_50_attiva, false)
  INTO
    v_profit_coefficient,
    v_tax_rate,
    v_inps_management,
    v_riduzione_35,
    v_riduzione_50
  FROM public.fiscal_year_settings fys
  WHERE fys.user_id = p_user_id
    AND fys.fiscal_year = p_fiscal_year
  LIMIT 1;

  IF v_inps_management IS NULL THEN
    -- Fallback: ultimo anno disponibile
    SELECT
      fys.profit_coefficient,
      fys.tax_rate,
      fys.inps_management,
      COALESCE(fys.riduzione_35_attiva, false),
      COALESCE(fys.riduzione_50_attiva, false)
    INTO
      v_profit_coefficient,
      v_tax_rate,
      v_inps_management,
      v_riduzione_35,
      v_riduzione_50
    FROM public.fiscal_year_settings fys
    WHERE fys.user_id = p_user_id
    ORDER BY fys.fiscal_year DESC
    LIMIT 1;
  END IF;

  -- Se non ci sono settings affatto, non possiamo calcolare
  IF v_inps_management IS NULL THEN
    RETURN NULL;
  END IF;

  -- Sanity check sui settings: coefficiente e tax_rate devono essere NOT NULL
  -- per evitare bias silenzioso nel denominatore NSM. Un utente con onboarding
  -- completato ma settings incompleti (edge case, colonne non sempre NOT NULL)
  -- viene loggato ed escluso.
  IF v_profit_coefficient IS NULL OR v_tax_rate IS NULL THEN
    RAISE NOTICE 'Incomplete fiscal_year_settings for user=%: coefficient=%, tax_rate=%',
      p_user_id, v_profit_coefficient, v_tax_rate;
    RETURN NULL;
  END IF;

  -- Incassi YTD per l'anno fiscale di riferimento
  SELECT COALESCE(SUM(r.gross_amount), 0)
  INTO v_incassi_ytd
  FROM public.receipts r
  WHERE r.user_id = p_user_id
    AND r.fiscal_year = p_fiscal_year;

  -- Load parametri fiscal_rules per l'anno fiscale
  SELECT
    fr.inps_rate_separata,
    fr.massimale_separata,
    fr.inps_rate_artigiani,
    fr.inps_rate_artigiani_alta,
    fr.minimale_artigiani,
    fr.massimale_artigiani,
    fr.inps_rate_commercianti,
    fr.inps_rate_commercianti_alta,
    fr.minimale_commercianti,
    fr.massimale_commercianti,
    fr.reddito_minimale,
    fr.soglia_reddito_prima_fascia,
    fr.maternita_annuale,
    fr.aliquota_sostitutiva_5,
    fr.aliquota_sostitutiva_15
  INTO
    v_inps_rate_sep,
    v_massimale_sep,
    v_inps_rate_art,
    v_inps_rate_art_alta,
    v_minimale_art,
    v_massimale_art,
    v_inps_rate_comm,
    v_inps_rate_comm_alta,
    v_minimale_comm,
    v_massimale_comm,
    v_reddito_minimale,
    v_soglia_prima_fascia,
    v_maternita,
    v_aliq_5,
    v_aliq_15
  FROM public.fiscal_rules fr
  WHERE fr.fiscal_year = p_fiscal_year
  LIMIT 1;

  IF v_inps_rate_sep IS NULL THEN
    -- fiscal_rules mancanti per l'anno: non calcolabile
    RAISE NOTICE 'fiscal_rules missing for fiscal_year=%, user=%', p_fiscal_year, p_user_id;
    RETURN NULL;
  END IF;

  -- Derivazione aliquota sostitutiva (5 o 15) da tax_rate utente
  v_aliquota := CASE WHEN v_tax_rate <= 5 THEN v_aliq_5 ELSE v_aliq_15 END;

  -- Imponibile = incassi * coefficiente redditivita
  v_imponibile := ROUND(v_incassi_ytd * v_profit_coefficient / 100, 2);

  -- =========================================================================
  -- BRANCHING PER GESTIONE
  -- =========================================================================
  IF v_inps_management = 'separata' THEN
    -- Separata: INPS su imponibile (cap massimale), imposta su (imponibile - INPS)
    v_contributi := CASE
      WHEN v_massimale_sep > 0 THEN LEAST(v_imponibile, v_massimale_sep)
      ELSE v_imponibile
    END;
    v_contributi := ROUND(v_contributi * v_inps_rate_sep / 100, 2);

  ELSIF v_inps_management IN ('artigiani', 'commercianti') THEN
    -- Art/Comm: minimale fisso + variabile (doppia fascia)

    -- 1. Minimale (con riduzione 50 o 35 se attive, mutual exclusivity)
    IF v_inps_management = 'artigiani' THEN
      v_minimale_effettivo := v_minimale_art;
    ELSE
      v_minimale_effettivo := v_minimale_comm;
    END IF;

    IF v_riduzione_50 THEN
      -- 50% solo su IVS, maternita' intatta (Circ. INPS 83/2025)
      v_minimale_ivs := v_minimale_effettivo - v_maternita;
      v_minimale_effettivo := ROUND(v_minimale_ivs * 0.5, 2) + v_maternita;
    ELSIF v_riduzione_35 THEN
      v_minimale_effettivo := ROUND(v_minimale_effettivo * 0.65, 2);
    END IF;

    -- 2. Variabile (doppia fascia oltre reddito_minimale, cap massimale)
    IF v_inps_management = 'artigiani' THEN
      v_base_var := CASE
        WHEN v_massimale_art > 0 THEN LEAST(v_imponibile, v_massimale_art)
        ELSE v_imponibile
      END;
      v_inps_rate_art_eff := v_inps_rate_art;
    ELSE
      v_base_var := CASE
        WHEN v_massimale_comm > 0 THEN LEAST(v_imponibile, v_massimale_comm)
        ELSE v_imponibile
      END;
      v_inps_rate_comm_eff := v_inps_rate_comm;
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

      -- Applica riduzione sul variabile (mutual exclusivity: 50 prevale su 35)
      IF v_riduzione_50 THEN
        v_variabile := ROUND(v_variabile * 0.5, 2);
      ELSIF v_riduzione_35 THEN
        v_variabile := ROUND(v_variabile * 0.65, 2);
      END IF;
    ELSE
      v_variabile := 0;
    END IF;

    v_contributi := v_minimale_effettivo + v_variabile;

  ELSE
    -- Gestione sconosciuta: non calcolabile
    RAISE NOTICE 'unknown inps_management=% for user=%', v_inps_management, p_user_id;
    RETURN NULL;
  END IF;

  -- =========================================================================
  -- IMPOSTA SOSTITUTIVA CON DEDUCIBILITA' INPS
  -- =========================================================================
  v_imponibile_netto := GREATEST(0, v_imponibile - v_contributi);
  v_imposta := ROUND(v_imponibile_netto * v_aliquota / 100, 2);

  -- Totale accantonamento = imposta + contributi INPS
  RETURN ROUND(v_contributi + v_imposta, 2);
END;
$$;

COMMENT ON FUNCTION public._calc_totale_accantonamento(UUID, INTEGER) IS
  'Story 75-2a. Replica la formula totaleAccantonamento di fiscal-engine.ts::calcTotaleMultiGestione. Ritorna NULL se settings o fiscal_rules mancanti (escluso dal denominatore NSM). PRIVATA: nessun EXECUTE a anon/authenticated (vedi REVOKE sotto). Chiamata solo da get_nsm_scadenze_coperte.';

-- Blocca l'accesso pubblico alla helper: essendo SECURITY DEFINER (bypassa RLS)
-- un GRANT di default PUBLIC EXECUTE permetterebbe a qualsiasi utente
-- authenticated di leggere totaleAccantonamento di UUID arbitrari. Pattern
-- consolidato nel codebase (cfr. _contribution_totals, check_lockout,
-- reincrement_launch_cap).
REVOKE ALL ON FUNCTION public._calc_totale_accantonamento(UUID, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._calc_totale_accantonamento(UUID, INTEGER) FROM anon, authenticated;


-- ----------------------------------------------------------------------------
-- 3. RPC principale: get_nsm_scadenze_coperte
--    Ritorna JSON composito con NSM percent, conteggi, breakdown per bucket.
-- ----------------------------------------------------------------------------
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
    -- 3 anni di retroattivita' sufficienti per baseline storica; oltre, fiscal_rules
    -- spesso assenti e risultato degenerato (tutti NULL) senza segnalazione.
    RAISE EXCEPTION 'reference_date too far in the past (>3 anni): %', p_reference_date;
  END IF;

  IF p_gestione_filter IS NOT NULL
     AND p_gestione_filter NOT IN ('separata', 'artigiani', 'commercianti') THEN
    RAISE EXCEPTION 'Invalid gestione_filter: % (allowed: separata|artigiani|commercianti)', p_gestione_filter;
  END IF;

  v_fiscal_year := EXTRACT(YEAR FROM p_reference_date)::INTEGER;

  WITH
  -- Utenti non-internal con onboarding completato
  valid_users AS (
    SELECT p.user_id
    FROM public.profiles p
    WHERE p.is_internal IS NOT TRUE
      AND p.onboarding_completed = true
  ),
  -- Per ogni utente valido: la prossima scadenza non pagata in finestra
  -- T +/- p_window_days. Esclude residui <= 0.
  next_deadline AS (
    SELECT DISTINCT ON (ts.user_id)
      ts.user_id,
      ts.bucket,
      ts.due_date,
      (ts.total_expected - ts.total_paid) AS residuo
    FROM public.tax_schedule ts
    JOIN valid_users v ON v.user_id = ts.user_id
    WHERE ts.status != 'paid'
      AND ts.due_date >= p_reference_date
      AND ts.due_date <= p_reference_date + p_window_days
      AND (ts.total_expected - ts.total_paid) > 0
    ORDER BY ts.user_id, ts.due_date ASC, ts.id ASC
  ),
  -- Applica filtro gestione (se richiesto) via fiscal_year_settings anno corrente
  -- con fallback all'ultimo anno disponibile. INNER JOIN: utenti senza alcuna
  -- riga in fiscal_year_settings vengono scartati immediatamente (semantica
  -- esplicita: non calcolabili, quindi fuori dal denominatore NSM) evitando
  -- chiamate inutili all'helper _calc_totale_accantonamento.
  observed AS (
    SELECT
      nd.user_id,
      nd.bucket,
      nd.due_date,
      nd.residuo,
      fys.inps_management
    FROM next_deadline nd
    JOIN LATERAL (
      SELECT f.inps_management
      FROM public.fiscal_year_settings f
      WHERE f.user_id = nd.user_id
      ORDER BY
        CASE WHEN f.fiscal_year = v_fiscal_year THEN 0 ELSE 1 END,
        f.fiscal_year DESC
      LIMIT 1
    ) fys ON true
    WHERE p_gestione_filter IS NULL
       OR fys.inps_management = p_gestione_filter
  ),
  -- Calcola accantonamento per ogni osservato via helper
  coverage AS (
    SELECT
      o.user_id,
      o.bucket,
      o.residuo,
      public._calc_totale_accantonamento(o.user_id, v_fiscal_year) AS accantonamento
    FROM observed o
  ),
  -- Flag coperto + escludi utenti senza calcolo possibile
  coverage_flagged AS (
    SELECT
      c.user_id,
      c.bucket,
      c.residuo,
      c.accantonamento,
      (c.accantonamento >= c.residuo) AS covered
    FROM coverage c
    WHERE c.accantonamento IS NOT NULL
  ),
  -- Aggregato globale
  totals AS (
    SELECT
      COUNT(*)::BIGINT AS total_observed,
      COUNT(*) FILTER (WHERE covered = true)::BIGINT AS covered_count,
      COUNT(*) FILTER (WHERE covered = false)::BIGINT AS uncovered_count
    FROM coverage_flagged
  ),
  -- Breakdown per bucket (ordinamento applicato nel json_agg a valle: un
  -- ORDER BY qui sarebbe morto perche' le CTE non preservano l'ordine).
  by_bucket_agg AS (
    SELECT
      bucket,
      COUNT(*)::BIGINT AS observed,
      COUNT(*) FILTER (WHERE covered = true)::BIGINT AS covered
    FROM coverage_flagged
    GROUP BY bucket
  ),
  by_bucket_json AS (
    SELECT COALESCE(json_agg(
      json_build_object(
        'bucket', b.bucket,
        'covered', b.covered,
        'observed', b.observed,
        'percent', ROUND(b.covered * 100.0 / NULLIF(b.observed, 0), 1)
      )
      ORDER BY b.observed DESC, b.bucket ASC
    ), '[]'::json) AS val
    FROM by_bucket_agg b
  )
  SELECT json_build_object(
    'nsm_percent', CASE
      WHEN t.total_observed = 0 THEN NULL
      ELSE ROUND(t.covered_count * 100.0 / NULLIF(t.total_observed, 0), 1)
    END,
    'covered_count', t.covered_count,
    'uncovered_count', t.uncovered_count,
    'total_observed', t.total_observed,
    'reference_date', p_reference_date,
    'window_days', p_window_days,
    'gestione_filter', p_gestione_filter,
    'by_bucket', bj.val
  )
  INTO result
  FROM totals t, by_bucket_json bj;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_nsm_scadenze_coperte(DATE, INTEGER, TEXT) IS
  'Story 75-2a. North Star Metric: % utenti con totaleAccantonamento >= residuo prossima scadenza in finestra T+window_days. Admin-only.';

GRANT EXECUTE ON FUNCTION public.get_nsm_scadenze_coperte(DATE, INTEGER, TEXT) TO authenticated;


-- ============================================================================
-- EXAMPLE QUERIES (manual test scenarios — non eseguibili in produzione,
-- richiedono seed dati). Commentate. Scenari da AC7 della story.
-- ============================================================================

-- -- Scenario base: NSM oggi, tutti gli utenti
-- SELECT public.get_nsm_scadenze_coperte();
--
-- -- Scenario con finestra piu' ampia (30 giorni)
-- SELECT public.get_nsm_scadenze_coperte(CURRENT_DATE, 30);
--
-- -- Scenario filtro gestione artigiani
-- SELECT public.get_nsm_scadenze_coperte(CURRENT_DATE, 7, 'artigiani');
--
-- -- Scenario data storica (baseline retroattiva)
-- SELECT public.get_nsm_scadenze_coperte('2026-03-31'::DATE, 7);
--
-- -- Debug helper singolo utente (sostituisci UUID con un user_id reale)
-- SELECT public._calc_totale_accantonamento('00000000-0000-0000-0000-000000000000'::UUID, 2026);
--
-- -- EXPLAIN ANALYZE per benchmark SLA (target < 1s con 1000 utenti)
-- EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
--   SELECT public.get_nsm_scadenze_coperte();
--
-- -- Dataset sanity check: quante scadenze in finestra T+7gg?
-- SELECT COUNT(*) AS deadlines_in_window
-- FROM public.tax_schedule ts
-- JOIN public.profiles p ON p.user_id = ts.user_id
-- WHERE p.is_internal IS NOT TRUE
--   AND p.onboarding_completed = true
--   AND ts.status != 'paid'
--   AND ts.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
--   AND (ts.total_expected - ts.total_paid) > 0;

-- ============================================================================
-- AC7 TEST SCENARIOS (riferimento — vanno eseguiti contro dataset di staging
-- con seed manuale che rispecchi ciascuno dei 7 scenari descritti nella story
-- 75-2a). Le query sopra coprono l'aggregato finale; la verifica di ogni
-- scenario passa/fallisce via confronto del JSON ritornato col payload atteso.
--
-- Scenario 1 — utente coperto (separata):
--   SEED: user A, inps_management='separata', incassiYTD=10000, coeff=78,
--   tax_rate=15, fiscal_year=2026. Scadenza saldo_tax residua 500 EUR +3gg.
--   ASSERT: result->>'covered_count' = '1', by_bucket include saldo_tax 1/1.
--
-- Scenario 2 — artigiani NON coperto:
--   SEED: user B, inps_management='artigiani', incassiYTD=500, riduzione_50=true.
--   Scadenza saldo_tax residua 5000 EUR +5gg.
--   ASSERT: uncovered_count = 1 (accantonamento teorico ~2260 < 5000).
--
-- Scenario 3 — fuori finestra:
--   SEED: user C con scadenza unica a +15gg. ASSERT: total_observed = 0 per
--   p_window_days=7 (utente non osservato); total_observed=1 per window=30.
--
-- Scenario 4 — internal escluso:
--   SEED: user D, is_internal=true, scadenza in finestra.
--   ASSERT: total_observed non aumenta su user D.
--
-- Scenario 5 — residuo zero:
--   SEED: user E, tax_schedule total_expected=1000 total_paid=1000 status='paid'.
--   ASSERT: non osservato (status = paid E residuo 0 sono esclusi).
--
-- Scenario 6 — denominatore vuoto:
--   SEED: nessun utente con scadenza in finestra.
--   ASSERT: nsm_percent IS NULL, total_observed=0, by_bucket=[].
--
-- Scenario 7 — filtro gestione:
--   SEED: 2 utenti separata coperti + 1 artigiani non coperto (tutti in finestra).
--   CALL: get_nsm_scadenze_coperte(CURRENT_DATE, 7, 'separata').
--   ASSERT: covered_count=2, total_observed=2, nsm_percent=100,
--   by_bucket contiene solo i bucket dei 2 utenti separata.
-- ============================================================================
