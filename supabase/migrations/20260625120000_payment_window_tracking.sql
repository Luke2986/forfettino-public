-- ============================================================================
-- Feature: tracking della FINESTRA di versamento nel "Segna come pagata"
-- ============================================================================
-- La proroga forfettari/ISA (D.L. 86/2026) spacchetta il vecchio termine unico
-- 30/06 del saldo + 1° acconto (rata `june`) in più finestre:
--   ordinary     entro 30/06            — nessuna maggiorazione
--   proroga      1–20 luglio            — nessuna maggiorazione
--   differimento 21 luglio–20 agosto    — +0,80% di maggiorazione
--   late         oltre il 20 agosto     — ravvedimento (sanzioni/interessi)
--
-- Questa migration:
--   1. aggiunge payment_window + surcharge_cents a payment_discrepancies;
--   2. estende mark_tax_schedule_paid per persistirli e calcolare il delta vs
--      l'atteso DELLA FINESTRA (stima + maggiorazione) → un differimento pagato
--      correttamente resta in banda verde, non falsa l'accuratezza engine;
--   3. estende get_payment_discrepancy_stats con il breakdown per finestra +
--      la maggiorazione totale incassata (widget admin NSM).
--
-- IMPORTANT: amount_estimated_cents resta la STIMA BASE del motore. La
-- maggiorazione legale è isolata in surcharge_cents (zero approssimazione +
-- analisi engine-accuracy pulita).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Nuove colonne su payment_discrepancies
-- ----------------------------------------------------------------------------
ALTER TABLE public.payment_discrepancies
  ADD COLUMN IF NOT EXISTS payment_window TEXT
    CHECK (payment_window IN ('ordinary', 'proroga', 'differimento', 'late')),
  ADD COLUMN IF NOT EXISTS surcharge_cents BIGINT NOT NULL DEFAULT 0;

-- Indice per il breakdown per finestra (le righe valorizzate sono una minoranza:
-- solo la rata giugno in anni con proroga).
CREATE INDEX IF NOT EXISTS idx_payment_discrepancies_window
  ON public.payment_discrepancies (payment_window)
  WHERE payment_window IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. mark_tax_schedule_paid — firma estesa (+ payment_window, + surcharge_cents)
-- ----------------------------------------------------------------------------
-- Aggiungere parametri cambia la firma → drop esplicito della vecchia versione
-- (11 arg) prima della create, per non lasciare overload ambigui.
DROP FUNCTION IF EXISTS public.mark_tax_schedule_paid(
  UUID, BIGINT, DATE, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT
);

CREATE OR REPLACE FUNCTION public.mark_tax_schedule_paid(
  p_schedule_id UUID,
  p_amount_paid_cents BIGINT,
  p_payment_date DATE,
  p_payment_type TEXT,
  p_amount_estimated_cents BIGINT,
  p_tolerance_band TEXT,
  p_reason_code TEXT DEFAULT NULL,
  p_discrepancy_category TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_engine_snapshot JSONB DEFAULT NULL,
  p_engine_version TEXT DEFAULT NULL,
  p_payment_window TEXT DEFAULT NULL,
  p_surcharge_cents BIGINT DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_bucket TEXT;
  v_payment_year INTEGER;
  v_reference_year INTEGER;
  v_status TEXT;
  v_surcharge BIGINT := COALESCE(p_surcharge_cents, 0);
  v_expected BIGINT;
  v_delta_cents BIGINT;
  v_delta_pct NUMERIC;
  v_payment_id UUID;
  v_discrepancy_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_amount_paid_cents IS NULL OR p_amount_paid_cents <= 0 THEN
    RAISE EXCEPTION 'Importo pagato non valido';
  END IF;

  IF v_surcharge < 0 THEN
    RAISE EXCEPTION 'Maggiorazione non valida';
  END IF;

  IF p_payment_window IS NOT NULL
     AND p_payment_window NOT IN ('ordinary', 'proroga', 'differimento', 'late') THEN
    RAISE EXCEPTION 'Finestra di versamento non valida: %', p_payment_window;
  END IF;

  -- Difesa anti-abuso: lo snapshot e' un oggetto fisso (~300 byte). Un client
  -- che bypassa il layer TS potrebbe gonfiare lo storage con blob enormi.
  IF p_engine_snapshot IS NOT NULL AND octet_length(p_engine_snapshot::text) > 8192 THEN
    RAISE EXCEPTION 'engine_snapshot too large';
  END IF;

  -- Serializza doppi click / richieste concorrenti sulla stessa rata
  PERFORM pg_advisory_xact_lock(
    hashtext('mark_paid_' || v_uid::text || '_' || p_schedule_id::text)
  );

  -- Ownership + carica i campi che servono per la riga discrepancy
  SELECT bucket, payment_year, reference_year, status
    INTO v_bucket, v_payment_year, v_reference_year, v_status
  FROM public.tax_schedule
  WHERE id = p_schedule_id AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tax schedule not found or not owned by user';
  END IF;

  -- Idempotenza: se la rata e' gia' pagata, non duplicare il pagamento (il
  -- lock serializza ma non deduplica fra transazioni successive — es. due tab).
  IF v_status = 'paid' THEN
    RETURN NULL;
  END IF;

  -- Delta calcolato server-side vs l'atteso DELLA FINESTRA (stima + maggiorazione
  -- legale): un differimento pagato per intero (base + 0,80%) ha delta 0.
  v_expected := p_amount_estimated_cents + v_surcharge;
  v_delta_cents := p_amount_paid_cents - v_expected;
  v_delta_pct := CASE
    WHEN v_expected > 0
      THEN v_delta_cents::numeric / v_expected
    ELSE NULL
  END;

  -- 1) Registra il pagamento REALE nel ledger. Il trigger
  --    update_tax_schedule_on_payment (AFTER INSERT) aggiorna total_paid.
  INSERT INTO public.payments (
    user_id, amount, payment_date, payment_type, tax_schedule_id, notes
  ) VALUES (
    v_uid,
    p_amount_paid_cents::numeric / 100.0,
    p_payment_date,
    p_payment_type,
    p_schedule_id,
    'Rata segnata come pagata'
  )
  RETURNING id INTO v_payment_id;

  -- 2) Forza status='paid'. "Segna come pagata" e' un'intenzione esplicita
  --    dell'utente: se il pagato reale e' MINORE della stima (es. credito
  --    compensato), il trigger lascerebbe status='partial' lasciando la rata
  --    tra le aperte. L'override garantisce coerenza con l'azione utente.
  UPDATE public.tax_schedule
  SET status = 'paid'
  WHERE id = p_schedule_id AND user_id = v_uid;

  -- 3) Logga la discrepanza (sempre, anche entro tolleranza → distribuzione
  --    completa dei delta per tarare le soglie + base NSM).
  INSERT INTO public.payment_discrepancies (
    user_id, tax_schedule_id, payment_id, fiscal_year, reference_year, bucket,
    amount_estimated_cents, amount_paid_cents, delta_cents, delta_pct,
    tolerance_band, reason_code, discrepancy_category, note,
    engine_params_snapshot, engine_version,
    payment_window, surcharge_cents
  ) VALUES (
    v_uid, p_schedule_id, v_payment_id, v_payment_year, v_reference_year, v_bucket,
    p_amount_estimated_cents, p_amount_paid_cents, v_delta_cents, v_delta_pct,
    p_tolerance_band, p_reason_code, p_discrepancy_category, p_note,
    p_engine_snapshot, p_engine_version,
    p_payment_window, v_surcharge
  )
  RETURNING id INTO v_discrepancy_id;

  RETURN v_discrepancy_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_tax_schedule_paid(
  UUID, BIGINT, DATE, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, BIGINT
) TO authenticated;

-- ----------------------------------------------------------------------------
-- 3. get_payment_discrepancy_stats — breakdown finestra + maggiorazione incassata
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_payment_discrepancy_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT jsonb_build_object(
    -- NSM retroattivo: utenti distinti che hanno segnato >=1 tassa pagata (ledger).
    'nsm_users',        (SELECT COUNT(DISTINCT user_id)
                           FROM public.payments
                           WHERE tax_schedule_id IS NOT NULL),
    -- Accuratezza forward-only: tutto cio' che segue e' su payment_discrepancies.
    'tracked_marks',    COUNT(*),
    'tracking_since',   MIN(marked_at)::date,
    'green',            COUNT(*) FILTER (WHERE tolerance_band = 'green'),
    'yellow',           COUNT(*) FILTER (WHERE tolerance_band = 'yellow'),
    'red',              COUNT(*) FILTER (WHERE tolerance_band = 'red'),
    'green_percent',    CASE WHEN COUNT(*) > 0
                          THEN ROUND(100.0 * COUNT(*) FILTER (WHERE tolerance_band = 'green') / COUNT(*), 1)
                          ELSE NULL END,
    -- Breakdown causa: solo le righe fuori tolleranza hanno un motivo/categoria.
    'reason_given',     COUNT(*) FILTER (WHERE reason_code IS NOT NULL),
    'category_reality', COUNT(*) FILTER (WHERE discrepancy_category = 'reality'),
    'category_engine',  COUNT(*) FILTER (WHERE discrepancy_category = 'engine'),
    'category_unknown', COUNT(*) FILTER (WHERE discrepancy_category = 'unknown'),
    -- Breakdown finestra di versamento (rata giugno in anni con proroga).
    'window_tracked',        COUNT(*) FILTER (WHERE payment_window IS NOT NULL),
    'window_ordinary',       COUNT(*) FILTER (WHERE payment_window = 'ordinary'),
    'window_proroga',        COUNT(*) FILTER (WHERE payment_window = 'proroga'),
    'window_differimento',   COUNT(*) FILTER (WHERE payment_window = 'differimento'),
    'window_late',           COUNT(*) FILTER (WHERE payment_window = 'late'),
    -- Maggiorazione legale totale incassata via differimento (centesimi).
    'surcharge_total_cents', COALESCE(SUM(surcharge_cents), 0)
  )
  INTO v_result
  FROM public.payment_discrepancies;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_payment_discrepancy_stats() TO authenticated;
