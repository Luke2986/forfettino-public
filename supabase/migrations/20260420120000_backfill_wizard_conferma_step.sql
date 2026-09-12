-- Backfill wizard_step_completed per step "conferma"
--
-- Contesto: prima del fix (commit c658498), handleFinish del wizard sparava
-- solo `wizard_completed` e mai `wizard_step_completed[step_id=conferma]`.
-- Di conseguenza la RPC get_wizard_funnel mostrava completed=0 sullo step
-- finale per TUTTI gli utenti già passati, nonostante l'onboarding fosse
-- completato con successo.
--
-- Questa migration inserisce eventi sintetici `wizard_step_completed` per
-- ogni utente che ha già un `wizard_completed` ma non l'evento di step
-- corrispondente, usando lo stesso timestamp del wizard_completed.
--
-- NOTE:
-- - Omettiamo `time_spent_seconds` → AVG nella RPC ignora automaticamente
--   i record privi della chiave (NULL), quindi il grafico "Tempo medio
--   per step" non viene falsato.
-- - Il flag `backfilled: true` permette di distinguere i record sintetici
--   da quelli reali in analisi future.
-- - Idempotente: NOT EXISTS protegge da doppie esecuzioni.

BEGIN;

INSERT INTO public.event_logs (user_id, event_name, props, created_at)
SELECT
  wc.user_id,
  'wizard_step_completed',
  jsonb_build_object(
    'step_id', 'conferma',
    'gestione', wc.props->>'gestione',
    'variant', COALESCE(wc.props->>'variant', 'control'),
    'backfilled', true
  ),
  wc.created_at
FROM public.event_logs wc
WHERE wc.event_name = 'wizard_completed'
  AND NOT EXISTS (
    SELECT 1
    FROM public.event_logs sc
    WHERE sc.user_id = wc.user_id
      AND sc.event_name = 'wizard_step_completed'
      AND sc.props->>'step_id' = 'conferma'
  );

-- Report inseriti (visibile nei log di esecuzione)
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.event_logs
  WHERE event_name = 'wizard_step_completed'
    AND props->>'step_id' = 'conferma'
    AND (props->>'backfilled')::boolean = true;
  RAISE NOTICE 'Backfill completato: % record wizard_step_completed[conferma] sintetici presenti', v_count;
END $$;

COMMIT;
