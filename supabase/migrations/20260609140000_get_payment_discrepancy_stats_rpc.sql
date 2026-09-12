-- ============================================================================
-- RPC: get_payment_discrepancy_stats — aggregati per il widget admin NSM
-- ============================================================================
-- Alimenta AdminMarkPaidNsmCard (sotto AdminNSMMiniCard nella dashboard admin).
-- DUE LAYER DISTINTI per gestire la non-retroattivita' del tracking:
--   - NSM (nsm_users): conteggio utenti che hanno segnato >=1 tassa pagata,
--     contato da public.payments (tax_schedule_id NOT NULL) → RETROATTIVO,
--     include i mark storici (art/comm inclusi) fatti prima del 2026-06-09.
--   - Accuratezza (green_percent) + banda + causa: da payment_discrepancies →
--     SOLO FORWARD (il reale lo cattura il flusso nuovo). I vecchi mark non
--     hanno il reale, quindi NON vanno conteggiati nell'accuratezza (sarebbero
--     falsi-verdi). tracking_since espone da quando il dato esiste.
--
-- Pattern simmetrico a get_nsm_adoption_funnel: SECURITY DEFINER + check admin
-- esplicito (le tabelle hanno gia' policy admin-read, ma l'aggregato server-side
-- evita di trasferire tutte le righe al client).
-- ============================================================================

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
    'category_unknown', COUNT(*) FILTER (WHERE discrepancy_category = 'unknown')
  )
  INTO v_result
  FROM public.payment_discrepancies;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_payment_discrepancy_stats() TO authenticated;
