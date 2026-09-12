-- ============================================================================
-- RPC: unmark_tax_schedule_paid — Annulla "segna come pagata" di una scadenza
-- ============================================================================
-- Contesto: la tab Scadenziario consente di segnare una rata come pagata
-- (INSERT in public.payments → trigger update_tax_schedule_on_payment porta
-- tax_schedule.status a 'paid'). Non esisteva alcun modo di annullare.
--
-- Vincolo DB scoperto: il trigger update_tax_schedule_on_payment è definito
-- SOLO su AFTER INSERT / AFTER UPDATE di payments e usa NEW. NON esiste un
-- trigger AFTER DELETE → una semplice DELETE lato client NON ricalcolerebbe
-- total_paid/status sulla tax_schedule. Per questo l'annullamento DEVE passare
-- da una funzione SECURITY DEFINER che cancella i payment E ricalcola la
-- schedule in modo atomico (stessa logica CASE del trigger).
--
-- Scope deliberato: NON tocca user_contributions/gamification (i punti
-- "scadenza_paid" di Epic 26 restano — revocarli sarebbe punitivo e fuori scope).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.unmark_tax_schedule_paid(p_schedule_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Serializza eventuali doppi click / richieste concorrenti sulla stessa rata
  PERFORM pg_advisory_xact_lock(
    hashtext('unmark_paid_' || v_uid::text || '_' || p_schedule_id::text)
  );

  -- Ownership: la scadenza deve appartenere all'utente autenticato
  IF NOT EXISTS (
    SELECT 1 FROM public.tax_schedule
    WHERE id = p_schedule_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Tax schedule not found or not owned by user';
  END IF;

  -- Cancella i pagamenti collegati a questa scadenza per questo utente.
  -- Solo il flusso "segna come pagata" (useMarkAsPaid) scrive in payments
  -- collegando tax_schedule_id, quindi questa DELETE è mirata e sicura.
  DELETE FROM public.payments
  WHERE tax_schedule_id = p_schedule_id
    AND user_id = v_uid;

  -- Ricalcolo esplicito (nessun trigger AFTER DELETE): stessa logica CASE di
  -- public.update_tax_schedule_on_payment.
  UPDATE public.tax_schedule
  SET
    total_paid = (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.payments
      WHERE tax_schedule_id = p_schedule_id
    ),
    status = CASE
      WHEN (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE tax_schedule_id = p_schedule_id) >= total_expected THEN 'paid'
      WHEN (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE tax_schedule_id = p_schedule_id) > 0 THEN 'partial'
      ELSE 'open'
    END
  WHERE id = p_schedule_id AND user_id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unmark_tax_schedule_paid(UUID) TO authenticated;
