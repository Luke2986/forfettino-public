-- Fix RLS INSERT policy on receipts (regressione introdotta da 20260307070000 + 20260322100000)
--
-- Problemi risolti:
-- 1. La policy precedente contava i receipts per EXTRACT(YEAR FROM CURRENT_DATE),
--    ignorando il fiscal_year del record inserito. Questo blocca gli insert per
--    anni passati e non riflette il limite "per anno fiscale" dichiarato in UI.
-- 2. La policy non distingueva per source, quindi un utente con 5 incassi
--    manuali vedeva il limite esaurito anche sugli import XML, pur avendo
--    un contatore client-side separato (FREE_IMPORT_LIMIT=3 vs FREE_RECEIPT_LIMIT=5).
-- 3. In un subquery con alias "r", il riferimento bare "fiscal_year" risolve
--    ambiguamente a r.fiscal_year (priorità di binding locale in PostgreSQL),
--    rendendo il fix cross-year di 20260213 semanticamente sbagliato.
--    Soluzione: delegare il check a una function plpgsql che riceve i
--    parametri del NEW row come argomenti espliciti.
--
-- Nuovi limiti Free tier (per fiscal_year):
--   - manual       ≤ 5
--   - xml_import   ≤ 3
--   - totale       ≤ 8 (safety net, naturalmente rispettato dai limiti sopra)

-- ============================================================================
-- 1. Funzione helper: enforcement limiti Free tier
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_receipt_insert_limit(
  _user_id uuid,
  _fiscal_year integer,
  _source text
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manual_count INTEGER;
  v_xml_count INTEGER;
  v_total_count INTEGER;
BEGIN
  -- Admin: no limit
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;

  -- Paid (Stripe): no limit
  IF EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
    AND tier IN ('pro', 'studio')
    AND status IN ('active', 'trialing')
  ) THEN
    RETURN TRUE;
  END IF;

  -- Admin override (pro/beta_tester): no limit
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
    AND admin_override_tier IN ('pro', 'beta_tester')
  ) THEN
    RETURN TRUE;
  END IF;

  -- Free: conta per fiscal_year del NEW record
  SELECT
    COUNT(*) FILTER (WHERE source = 'manual'),
    COUNT(*) FILTER (WHERE source = 'xml_import'),
    COUNT(*)
  INTO v_manual_count, v_xml_count, v_total_count
  FROM public.receipts
  WHERE user_id = _user_id
    AND fiscal_year = _fiscal_year;

  -- Limite per source
  IF _source = 'manual' AND v_manual_count >= 5 THEN
    RETURN FALSE;
  END IF;

  IF _source = 'xml_import' AND v_xml_count >= 3 THEN
    RETURN FALSE;
  END IF;

  -- Tetto unificato (safety net per future source non previste)
  IF v_total_count >= 8 THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_receipt_insert_limit(uuid, integer, text) TO authenticated;

-- ============================================================================
-- 2. Nuova RLS policy INSERT
-- ============================================================================
DROP POLICY IF EXISTS "Users can insert their own receipts" ON public.receipts;

CREATE POLICY "Users can insert their own receipts"
ON public.receipts
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.check_receipt_insert_limit(user_id, fiscal_year, source)
);
