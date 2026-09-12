-- ============================================================================
-- Story 75-2c: Refactor WCAF — Weekly Covered Active Freelancers
-- Epic 75: Activation Framework & NSM Dashboard
-- Data: 2026-04-18
--
-- Refactor della RPC get_nsm_scadenze_coperte da semantica WAC (window 7gg,
-- singola scadenza "prossima") a WCAF (Weekly Covered Active Freelancers,
-- window 60gg, somma residui multi-scadenza, trivial coverage inclusa).
--
-- Riferimento: docs/north-star-metric.md sezione 3 (WCAF definizione).
-- Motivazione (3 difetti WAC corretti):
--   1. Stagionalita' distorsiva con finestra 7gg — denominatore ~0 per 3-4
--      mesi/anno nelle stagioni senza scadenze concentrate. Finestra 60gg
--      stabilizza il segnale tutto l'anno.
--   2. Fan-out problem — DISTINCT ON considerava solo la prossima scadenza;
--      utente coperto sulla prossima ma scoperto su T+10gg risultava "coperto"
--      pur avendo una sorpresa imminente. WCAF somma TUTTI i residui in
--      finestra e confronta con accantonamento totale (vera "zero sorprese").
--   3. Utenti senza scadenze in finestra venivano esclusi dal denominatore.
--      Concettualmente sono "in regola" -> vanno contati come trivialmente
--      coperti nel numeratore (contribuiscono positivamente al segnale NSM).
--
-- Cambiamenti di contratto:
--   - Default p_window_days: 7 -> 60 (chiamanti che passano esplicitamente
--     7gg continuano a funzionare con la nuova semantica — le 4 CTE nuove
--     sono parametrizzate su p_window_days).
--   - Ritorno JSON esteso con nuovi campi: trivially_covered_count,
--     active_covered_count. Relazione:
--       covered_count = active_covered_count + trivially_covered_count
--       total_observed = active_total + trivially_covered_count
--       uncovered_count = active_total - active_covered_count
--   - Condizione activation: aggiunto filtro EXISTS receipt negli ultimi
--     90gg (WCAF.2: "prodotto vivo"). In WAC non c'era — un utente poteva
--     avere solo onboarding_completed e scadenza pendente.
--   - by_bucket: calcolato solo su utenti con scadenze reali (active), NON
--     include trivial (che non hanno bucket). Semantica invariata.
--
-- Zero breaking change per chiamanti esterni: firma funzione invariata,
-- tutti i parametri DEFAULT. I campi JSON nuovi sono ADDITIVI (chi consuma
-- solo nsm_percent/covered_count/total_observed non si accorge del cambio
-- oltre al shift numerico atteso della semantica).
--
-- Helper privato _calc_totale_accantonamento: INVARIATO. La formula
-- fiscal-engine e' corretta, cambia solo COME la consumiamo (contro la
-- SOMMA dei residui invece del residuo singolo).
--
-- Rollback: re-applicare 20260417100000_rpc_get_nsm_scadenze_coperte.sql
-- per ripristinare la semantica WAC (CREATE OR REPLACE e' atomico).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Indice per accelerare EXISTS receipts negli ultimi 90gg (WCAF.2)
-- Indice esistente idx_receipts_user_created e' su created_at (momento
-- registrazione). Per WCAF ci serve receipt_date (data evento fiscale).
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_receipts_user_receipt_date
  ON public.receipts (user_id, receipt_date);

-- ----------------------------------------------------------------------------
-- RPC get_nsm_scadenze_coperte — semantica WCAF
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_nsm_scadenze_coperte(
  p_reference_date DATE DEFAULT CURRENT_DATE,
  p_window_days INTEGER DEFAULT 60,
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
  -- Admin gate (invariato vs 75-2a)
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  -- Validazione input (invariato vs 75-2a)
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
  -- Utenti WCAF-eligible: non-internal, onboarding completato, con almeno
  -- un incasso negli ultimi 90gg (prodotto "vivo" per WCAF.2), risolvendo
  -- la inps_management dal fiscal_year_settings (per filtro gestione).
  -- INNER JOIN LATERAL: utenti senza settings vengono scartati (non
  -- calcolabili, stessa policy WAC).
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

  -- TUTTE le scadenze non pagate in finestra [reference_date, +window_days].
  -- Nessun DISTINCT ON: una riga per ciascuna scadenza del ciascun utente
  -- (fan-out corretto — WCAF somma i residui a valle).
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

  -- Somma dei residui per utente osservato (una riga per utente "attivo").
  user_residui AS (
    SELECT user_id, SUM(residuo) AS total_residuo
    FROM deadlines_in_window
    GROUP BY user_id
  ),

  -- Accantonamento via helper _calc_totale_accantonamento (INVARIATO dal 75-2a).
  -- La formula fiscale e' corretta: cambia solo il benchmark (SUM residui
  -- invece di residuo singolo).
  active_coverage AS (
    SELECT
      ur.user_id,
      ur.total_residuo,
      public._calc_totale_accantonamento(ur.user_id, v_fiscal_year) AS accantonamento
    FROM user_residui ur
  ),

  -- Flag coperto e filtra utenti con accantonamento NULL (esclusi dal
  -- denominatore: non calcolabili, policy invariata vs 75-2a).
  active_coverage_flagged AS (
    SELECT user_id, total_residuo, accantonamento,
      (accantonamento >= total_residuo) AS covered
    FROM active_coverage
    WHERE accantonamento IS NOT NULL
  ),

  -- Utenti "trivialmente coperti": WCAF-eligible ma senza alcuna scadenza
  -- non pagata nella finestra. Contati come coperti nel numeratore perche'
  -- concettualmente "in regola" (nulla da coprire).
  trivially_covered_users AS (
    SELECT v.user_id
    FROM valid_users v
    WHERE NOT EXISTS (
      SELECT 1 FROM deadlines_in_window d WHERE d.user_id = v.user_id
    )
  ),

  -- Breakdown per bucket: usa solo utenti "attivi" (con scadenze reali).
  -- Un utente con 2 scadenze (es. saldo_tax + inps_q2) in finestra contribuisce
  -- a entrambi i bucket. COUNT(DISTINCT) evita doppi conteggi su stesso bucket.
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

  -- Totali: trivial + active in un unico denominatore (WCAF).
  -- Aggregazione singola su active_coverage_flagged + sub-select su
  -- trivially_covered_users (CTE separato, senza campo "covered").
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

  -- Defense-in-depth: sanity check sulle identita' WCAF documentate al
  -- top di questo file. Protezione da refactor futuri che rompono le
  -- relazioni matematiche senza che i consumer se ne accorgano.
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
  'Story 75-2c (WCAF refactor). North Star Metric: % utenti WCAF-eligible (non-internal, onboarding, >=1 incasso ultimi 90gg) con accantonamento >= SUM(residui scadenze non pagate in finestra 60gg), OR nessuna scadenza in finestra (trivialmente coperto). Admin-only.';

GRANT EXECUTE ON FUNCTION public.get_nsm_scadenze_coperte(DATE, INTEGER, TEXT) TO authenticated;


-- ============================================================================
-- TEST SCENARIOS WCAF (riferimento manuale — eseguire su staging con seed).
-- Sostituisce gli scenari WAC di 75-2a; copre i 7 AC della story 75-2c.
--
-- Scenario 1 — utente coperto multi-scadenza (separata):
--   SEED: user A, inps_management='separata', incasso recente <90gg.
--   Scadenze in finestra 60gg: saldo_tax 2000 EUR + inps_q2 1000 EUR = 3000 EUR
--   totali residui. Accantonamento 3500 EUR.
--   ASSERT: active_covered_count=1, trivially_covered_count=0,
--   covered_count=1, total_observed=1, nsm_percent=100, by_bucket contiene
--   saldo_tax 1/1 + inps_q2 1/1.
--
-- Scenario 2 — utente NON coperto multi-scadenza:
--   SEED: user B, incasso recente. Scadenze 60gg somma 3000 EUR,
--   accantonamento 2000.
--   ASSERT: active_covered_count=0, uncovered_count=1,
--   trivially_covered_count=0, covered_count=0.
--
-- Scenario 3 — trivial coverage:
--   SEED: user C, onboarding, >=1 incasso ultimi 90gg, nessuna scadenza non
--   pagata in 60gg.
--   ASSERT: trivially_covered_count=1, active_covered_count=0,
--   covered_count=1, total_observed=1, nsm_percent=100. Non contribuisce a
--   by_bucket.
--
-- Scenario 4 — utente senza incassi recenti:
--   SEED: user D, onboarding=true, scadenza in finestra, MA ultimo incasso
--   oltre 90gg fa.
--   ASSERT: total_observed invariato su user D (escluso da valid_users —
--   non e' WCAF-eligible). Nessuno dei conteggi aumenta.
--
-- Scenario 5 — denominatore vuoto:
--   SEED: nessun utente WCAF-eligible.
--   ASSERT: nsm_percent IS NULL, total_observed=0, covered_count=0,
--   uncovered_count=0, trivially_covered_count=0, active_covered_count=0,
--   by_bucket=[].
--
-- Scenario 6 — filtro gestione:
--   SEED: 2 utenti separata (1 coperto attivo + 1 trivial) + 1 artigiani
--   non coperto, tutti in finestra 60gg.
--   CALL: get_nsm_scadenze_coperte(CURRENT_DATE, 60, 'separata').
--   ASSERT: active_covered_count=1, trivially_covered_count=1,
--   covered_count=2, total_observed=2, nsm_percent=100 (l'artigiani e'
--   filtrato fuori da valid_users).
--
-- Scenario 7 — window custom (regression compat):
--   CALL: get_nsm_scadenze_coperte(CURRENT_DATE, 30, NULL).
--   ASSERT: window_days=30 nel ritorno; scadenze in 31-60gg escluse dal
--   set active; utenti senza scadenze in 30gg ma con scadenze in 31-60gg
--   diventano trivially_covered.
--
-- Scenario 8 (regression WAC compat) — window=7:
--   CALL: get_nsm_scadenze_coperte(CURRENT_DATE, 7, NULL).
--   ASSERT: semantica equivalente a WAC originale MA con due differenze
--   intenzionali: (a) denominatore include trivial (utenti senza scadenze
--   in 7gg contati), (b) condizione WCAF.2 esclude utenti senza incassi
--   ultimi 90gg. Delta numerico atteso rispetto alla WAC originale;
--   documentarlo nella change log della prima misurazione post-deploy.
--
-- Esecuzione:
--   SELECT public.get_nsm_scadenze_coperte();  -- default 60gg
--   SELECT public.get_nsm_scadenze_coperte(CURRENT_DATE, 30);  -- custom window
--   SELECT public.get_nsm_scadenze_coperte(CURRENT_DATE, 60, 'separata');
--   EXPLAIN (ANALYZE, BUFFERS) SELECT public.get_nsm_scadenze_coperte();
-- ============================================================================
