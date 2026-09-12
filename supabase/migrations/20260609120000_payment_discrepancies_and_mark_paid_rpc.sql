-- ============================================================================
-- Feature: "Segna come pagata" con cattura importo reale + tracking discrepanza
-- ============================================================================
-- Contesto: la NSM di Forfettino sono gli utenti che segnano le tasse pagate
-- nello scadenziario. Forfettino e' un calcolatore approssimativo: il pagato
-- reale puo' differire dalla stima. Questa migration introduce:
--
--   1. payment_discrepancies : log di OGNI "segna come pagata" (anche entro
--      tolleranza) con stima, pagato reale, delta, banda, motivo, categoria e
--      snapshot degli input engine. Alimenta sia la NSM (count utenti con >=1
--      riga) sia il dataset di miglioramento del fiscal-engine.
--
--   2. mark_tax_schedule_paid : RPC atomica che, in un'unica transazione,
--      registra il pagamento reale in payments + scrive la riga discrepancy +
--      forza status='paid'. Simmetrica a unmark_tax_schedule_paid.
--
-- IMPORTANT: la classificazione della banda e il delta sono calcolati lato TS
-- (src/lib/tolerance.ts) — single source of truth fiscale — e passati come
-- parametri. La RPC NON ri-deriva logica fiscale in SQL (zero duplicazione).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabella payment_discrepancies
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- La scadenza resta referenziata; SET NULL se la schedule viene rigenerata/eliminata
  tax_schedule_id UUID REFERENCES public.tax_schedule(id) ON DELETE SET NULL,
  -- Link al ledger. SET NULL: la riga discrepancy SOPRAVVIVE all'unmark (che
  -- cancella il payment) — il dato engine non va perso.
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,

  -- fiscal_year = payment_year (anno in cui si paga → metrica di attivita' NSM).
  -- reference_year = anno degli incassi a cui le tasse si riferiscono (per le
  -- analisi engine-accuracy per anno fiscale, es. saldo giugno 2026 dell'anno 2025).
  fiscal_year INTEGER NOT NULL,
  reference_year INTEGER,
  bucket TEXT NOT NULL,

  -- Importi in CENTESIMI (integer esatto, coerente con money.ts)
  amount_estimated_cents BIGINT NOT NULL,
  amount_paid_cents BIGINT NOT NULL,
  delta_cents BIGINT NOT NULL,         -- paid - estimated (firmato)
  delta_pct NUMERIC,                   -- delta / estimated (firmato), null se stima 0

  tolerance_band TEXT NOT NULL CHECK (tolerance_band IN ('green', 'yellow', 'red')),
  reason_code TEXT,                    -- null se entro tolleranza (verde)
  discrepancy_category TEXT CHECK (discrepancy_category IN ('reality', 'engine', 'unknown')),
  note TEXT,

  engine_params_snapshot JSONB,
  engine_version TEXT,

  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indici per le query NSM (per anno) e per l'analisi engine (banda/categoria)
CREATE INDEX IF NOT EXISTS idx_payment_discrepancies_user_year
  ON public.payment_discrepancies (user_id, fiscal_year);
CREATE INDEX IF NOT EXISTS idx_payment_discrepancies_band
  ON public.payment_discrepancies (tolerance_band);
CREATE INDEX IF NOT EXISTS idx_payment_discrepancies_category
  ON public.payment_discrepancies (discrepancy_category)
  WHERE discrepancy_category IS NOT NULL;

-- RLS: l'utente vede solo le proprie righe. L'INSERT avviene SOLO via la RPC
-- SECURITY DEFINER (che bypassa RLS), quindi non serve una policy INSERT.
ALTER TABLE public.payment_discrepancies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payment discrepancies" ON public.payment_discrepancies;
CREATE POLICY "Users can view own payment discrepancies"
  ON public.payment_discrepancies
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admin: legge tutte le righe per il widget NSM + l'analisi engine-accuracy.
-- Pattern progetto: public.has_role(auth.uid(), 'admin').
DROP POLICY IF EXISTS "Admins can read all payment discrepancies" ON public.payment_discrepancies;
CREATE POLICY "Admins can read all payment discrepancies"
  ON public.payment_discrepancies
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ----------------------------------------------------------------------------
-- 2. RPC mark_tax_schedule_paid
-- ----------------------------------------------------------------------------
-- NOTA: delta_cents e delta_pct sono calcolati QUI server-side da paid-estimated
-- (aritmetica pura, nessuna logica fiscale duplicata) per garantire l'integrita'
-- del dataset analitico contro client che falsificherebbero lo scarto.
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
  p_engine_version TEXT DEFAULT NULL
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

  -- Delta calcolato server-side dai due importi ricevuti (ground truth).
  v_delta_cents := p_amount_paid_cents - p_amount_estimated_cents;
  v_delta_pct := CASE
    WHEN p_amount_estimated_cents > 0
      THEN v_delta_cents::numeric / p_amount_estimated_cents
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
    engine_params_snapshot, engine_version
  ) VALUES (
    v_uid, p_schedule_id, v_payment_id, v_payment_year, v_reference_year, v_bucket,
    p_amount_estimated_cents, p_amount_paid_cents, v_delta_cents, v_delta_pct,
    p_tolerance_band, p_reason_code, p_discrepancy_category, p_note,
    p_engine_snapshot, p_engine_version
  )
  RETURNING id INTO v_discrepancy_id;

  RETURN v_discrepancy_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_tax_schedule_paid(
  UUID, BIGINT, DATE, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT
) TO authenticated;
