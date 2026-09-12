-- ============================================================================
-- Story successiva a 75-2c: refactor NSM semantic da "Chiarezza Fiscale" (WCAF)
-- ad "Active Paymark Users" (APU) + funnel di adozione.
-- Data: 2026-04-18
--
-- Contesto: il NSM WCAF ("% utenti con accantonamento >= residui scadenze in
-- 90gg") confondeva il segnale di adozione prodotto con un paternalistico
-- "evito sorprese fiscali". Post query di discovery, APU risulta 2.8%
-- (5 / 176 attivi hanno marcato >=1 scadenza pagata quest'anno) — numero
-- drammatico ma HONEST, che misura il valore realmente consegnato e filtra
-- automaticamente i tourist registration.
--
-- Questa RPC calcola un funnel di adozione a 5 step + APU come headline,
-- tutto in un'unica chiamata SQL per consumi admin-side.
--
-- Funnel steps:
--   1. Iscritti      — profiles non-internal
--   2. Onboarded     — + onboarding_completed = true
--   3. Con incasso   — + >=1 receipts EVER
--   4. Attivi 90gg   — + >=1 receipts ultimi 90gg (denominatore APU)
--   5. Paymarked YTD — + >=1 tax_schedule riga status='paid' OR total_paid>0
--                      per l'anno corrente (numeratore APU)
--
-- APU = step5 / step4 * 100
--
-- Nota: lo step 5 usa payment_year = anno corrente, non reference_date — la
-- finestra "quest'anno" e' piu' intuitiva per admin di "ultimi 365gg".
-- Per l'altro, ad ogni gennaio l'APU parte da 0% e cresce. E' desiderato:
-- segnala quanto velocemente gli utenti riattivano la marcatura pagamenti.
--
-- Admin-only, zero dipendenze esterne, idempotente (CREATE OR REPLACE).
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
  -- Step 1: iscritti (esclusi internal test accounts).
  iscritti AS (
    SELECT p.user_id
    FROM public.profiles p
    WHERE p.is_internal IS NOT TRUE
  ),
  -- Step 2: hanno completato wizard onboarding.
  onboarded AS (
    SELECT user_id FROM iscritti
    WHERE user_id IN (
      SELECT p.user_id FROM public.profiles p
      WHERE p.is_internal IS NOT TRUE
        AND p.onboarding_completed = true
    )
  ),
  -- Step 3: hanno registrato almeno 1 incasso NELLA VITA. Filtra tourist che
  -- hanno completato onboarding ma non hanno mai usato il core loop.
  con_incasso AS (
    SELECT DISTINCT o.user_id
    FROM onboarded o
    WHERE EXISTS (
      SELECT 1 FROM public.receipts r WHERE r.user_id = o.user_id
    )
  ),
  -- Step 4: attivi negli ultimi 90gg (denominatore APU). Proxy di "prodotto
  -- ancora vivo per l'utente". Coerente con la definizione WCAF.2.
  attivi_90gg AS (
    SELECT DISTINCT ci.user_id
    FROM con_incasso ci
    WHERE EXISTS (
      SELECT 1 FROM public.receipts r
      WHERE r.user_id = ci.user_id
        AND r.receipt_date >= CURRENT_DATE - 90
    )
  ),
  -- Step 5: APU — hanno marcato almeno una scadenza pagata NELL'ANNO CORRENTE.
  -- total_paid > 0 cattura pagamenti parziali (acconti a rate); status='paid'
  -- cattura pagamenti completi anche se per caso total_paid e' 0 (bug protection).
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
        'label', 'Onboarding completo',
        'count', (SELECT COUNT(*) FROM onboarded),
        'percent_of_top', ROUND(
          (SELECT COUNT(*) FROM onboarded) * 100.0
          / NULLIF((SELECT COUNT(*) FROM iscritti), 0), 1
        )
      ),
      json_build_object(
        'key', 'con_incasso',
        'label', 'Hanno registrato ≥1 incasso',
        'count', (SELECT COUNT(*) FROM con_incasso),
        'percent_of_top', ROUND(
          (SELECT COUNT(*) FROM con_incasso) * 100.0
          / NULLIF((SELECT COUNT(*) FROM iscritti), 0), 1
        )
      ),
      json_build_object(
        'key', 'attivi_90gg',
        'label', 'Attivi ultimi 90 giorni',
        'count', (SELECT COUNT(*) FROM attivi_90gg),
        'percent_of_top', ROUND(
          (SELECT COUNT(*) FROM attivi_90gg) * 100.0
          / NULLIF((SELECT COUNT(*) FROM iscritti), 0), 1
        )
      ),
      json_build_object(
        'key', 'paymarked_ytd',
        'label', 'Hanno marcato ≥1 pagato',
        'count', (SELECT COUNT(*) FROM paymarked_ytd),
        'percent_of_top', ROUND(
          (SELECT COUNT(*) FROM paymarked_ytd) * 100.0
          / NULLIF((SELECT COUNT(*) FROM iscritti), 0), 1
        )
      )
    ),
    -- Headline NSM: APU = paymarked / attivi 90gg.
    -- Il denominatore scelto e' attivi_90gg (non iscritti): misura la
    -- conversione alla massima value realization tra chi USA davvero il
    -- prodotto, isolando il segnale dal rumore dei tourist.
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
  'North Star Metric APU (Active Paymark Users) + funnel di adozione. APU = % utenti attivi ultimi 90gg che hanno marcato >=1 scadenza pagata nell''anno corrente. Filtra tourist registration, misura value realization reale del prodotto. Admin-only.';

GRANT EXECUTE ON FUNCTION public.get_nsm_adoption_funnel() TO authenticated;
