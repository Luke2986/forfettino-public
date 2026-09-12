-- ============================================================================
-- Hot-fix: ripristino semantica APU corretta (seguito di 7aab1de 2026-04-18).
-- Data: 2026-04-19
--
-- Contesto: la migration 20260418162427_d5444106-...sql (prodotta da Lovable
-- nella pipeline automatica) ha sovrascritto `get_nsm_adoption_funnel`
-- snaturandone la semantica:
--   - Step 5 cambiato da `paymarked_ytd` (utenti con >=1 scadenza marcata
--     pagata nell'anno corrente) a `with_schedule` (utenti con >=1 riga
--     tax_schedule qualsiasi) — il numeratore non misura piu' value
--     realization.
--   - Formula APU cambiata da `paymarked_ytd / attivi_90gg` a
--     `with_schedule / signed_up` — un denominatore diverso che gonfia
--     artificialmente il numero (35.8% invece di ~2.8% reale).
--   - Shape JSON cambiata: chiavi `apu_count`/`total_signed_up`/`step`/
--     `percent` invece di `apu_numerator`/`apu_denominator`/`key`/
--     `percent_of_top` → widget mostra "undefined" silenti.
--
-- Questa migration riporta la RPC alla semantica originale di 7aab1de:
--   APU = % utenti attivi ultimi 90gg che hanno marcato >=1 scadenza pagata
--         nell'anno corrente.
-- Shape JSON compatibile col widget (commit 7aab1de) senza nuove modifiche FE.
-- Adottate le label italiane introdotte da Lovable (coerenza UX): "Iscritti",
-- "Onboarding completato", "Primo incasso", "Attivi (90gg)", "Hanno marcato
-- pagato". Quinta label italianizzata rispetto all'originale "Hanno marcato
-- >=1 pagato" per parita' stilistica con gli altri step.
--
-- Idempotente via CREATE OR REPLACE. Timestamp 20260419080000 posteriore alla
-- migration Lovable 20260418162427 → vince nell'ordine di applicazione.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_nsm_adoption_funnel()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  v_current_year INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

  WITH
  iscritti AS (
    SELECT p.user_id
    FROM public.profiles p
    WHERE p.is_internal IS NOT TRUE
  ),
  onboarded AS (
    SELECT user_id FROM iscritti
    WHERE user_id IN (
      SELECT p.user_id FROM public.profiles p
      WHERE p.is_internal IS NOT TRUE
        AND p.onboarding_completed = true
    )
  ),
  con_incasso AS (
    SELECT DISTINCT o.user_id
    FROM onboarded o
    WHERE EXISTS (
      SELECT 1 FROM public.receipts r WHERE r.user_id = o.user_id
    )
  ),
  attivi_90gg AS (
    SELECT DISTINCT ci.user_id
    FROM con_incasso ci
    WHERE EXISTS (
      SELECT 1 FROM public.receipts r
      WHERE r.user_id = ci.user_id
        AND r.receipt_date >= CURRENT_DATE - 90
    )
  ),
  -- CRITICAL: step 5 = utenti che hanno MARCATO PAGATO almeno una scadenza
  -- nell'anno corrente. total_paid > 0 cattura anche pagamenti parziali;
  -- status='paid' cattura pagamenti completi. NON confondere con la
  -- semplice presenza di righe tax_schedule (che e' quello che faceva la
  -- migration Lovable deformata).
  paymarked_ytd AS (
    SELECT DISTINCT a.user_id
    FROM attivi_90gg a
    WHERE EXISTS (
      SELECT 1 FROM public.tax_schedule ts
      WHERE ts.user_id = a.user_id
        AND ts.payment_year = v_current_year
        AND (ts.status = 'paid' OR ts.total_paid > 0)
    )
  )
  SELECT json_build_object(
    'fiscal_year', v_current_year,
    'reference_date', CURRENT_DATE,
    'funnel', json_build_array(
      json_build_object(
        'key', 'iscritti',
        'label', 'Iscritti',
        'count', (SELECT COUNT(*) FROM iscritti),
        'percent_of_top', 100.0
      ),
      json_build_object(
        'key', 'onboarded',
        'label', 'Onboarding completato',
        'count', (SELECT COUNT(*) FROM onboarded),
        'percent_of_top', ROUND(
          (SELECT COUNT(*) FROM onboarded) * 100.0
          / NULLIF((SELECT COUNT(*) FROM iscritti), 0), 1
        )
      ),
      json_build_object(
        'key', 'con_incasso',
        'label', 'Primo incasso',
        'count', (SELECT COUNT(*) FROM con_incasso),
        'percent_of_top', ROUND(
          (SELECT COUNT(*) FROM con_incasso) * 100.0
          / NULLIF((SELECT COUNT(*) FROM iscritti), 0), 1
        )
      ),
      json_build_object(
        'key', 'attivi_90gg',
        'label', 'Attivi (90gg)',
        'count', (SELECT COUNT(*) FROM attivi_90gg),
        'percent_of_top', ROUND(
          (SELECT COUNT(*) FROM attivi_90gg) * 100.0
          / NULLIF((SELECT COUNT(*) FROM iscritti), 0), 1
        )
      ),
      json_build_object(
        'key', 'paymarked_ytd',
        'label', 'Hanno marcato pagato',
        'count', (SELECT COUNT(*) FROM paymarked_ytd),
        'percent_of_top', ROUND(
          (SELECT COUNT(*) FROM paymarked_ytd) * 100.0
          / NULLIF((SELECT COUNT(*) FROM iscritti), 0), 1
        )
      )
    ),
    -- Headline APU: paymarked_ytd / attivi_90gg — misura la conversione al
    -- vero momento di valore tra chi USA il prodotto (attivi 90gg), non tra
    -- tutti gli iscritti. E' il segnale che filtra tourist.
    'apu_percent', ROUND(
      (SELECT COUNT(*) FROM paymarked_ytd) * 100.0
      / NULLIF((SELECT COUNT(*) FROM attivi_90gg), 0), 1
    ),
    'apu_numerator', (SELECT COUNT(*) FROM paymarked_ytd),
    'apu_denominator', (SELECT COUNT(*) FROM attivi_90gg)
  )
  INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.get_nsm_adoption_funnel() IS
  'APU North Star Metric (restored 2026-04-19). APU = % utenti attivi ultimi 90gg che hanno marcato >=1 scadenza pagata nell''anno corrente. Ripristina la semantica corretta dopo l''override inavvertito di 20260418162427_d5444106. Admin-only.';

GRANT EXECUTE ON FUNCTION public.get_nsm_adoption_funnel() TO authenticated;
