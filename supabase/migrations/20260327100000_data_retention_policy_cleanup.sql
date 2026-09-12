-- Data Retention Policy — GDPR Art. 5(1)(e) Storage Limitation
-- Crea una funzione di pulizia periodica per tabelle con dati personali
-- senza TTL definito. Pensata per pg_cron (Supabase Pro+).
--
-- Retention:
--   survey_responses  → 24 mesi (anonimizza, mantieni score aggregato)
--   email_log         → 6 mesi (elimina)
--   user_sessions     → 12 mesi (elimina)
--   event_logs        → 12 mesi (elimina)
--   referrals.source_ip → 30 giorni (nullifica — già esistente, ora automatizzato)

-- UUID tombstone per righe anonimizzate (non collide con utenti reali)
-- Usato da export-user-data per escludere righe anonime dall'export
DO $$
BEGIN
  RAISE NOTICE 'Tombstone UUID for anonymized rows: 00000000-0000-0000-0000-000000000000';
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey_anon   int := 0;
  v_email_del     int := 0;
  v_sessions_del  int := 0;
  v_events_del    int := 0;
  v_referral_null int := 0;
BEGIN
  -- 1. Survey responses > 24 mesi: anonimizza (mantieni score/reason per trend NPS)
  WITH updated AS (
    UPDATE survey_responses
    SET user_id = '00000000-0000-0000-0000-000000000000',
        comment = NULL,
        free_text = NULL
    WHERE created_at < NOW() - INTERVAL '24 months'
      AND user_id != '00000000-0000-0000-0000-000000000000'
    RETURNING id
  )
  SELECT count(*) INTO v_survey_anon FROM updated;

  -- 2. Email log > 6 mesi: elimina
  WITH deleted AS (
    DELETE FROM email_log
    WHERE sent_at < NOW() - INTERVAL '6 months'
    RETURNING id
  )
  SELECT count(*) INTO v_email_del FROM deleted;

  -- 3. User sessions > 12 mesi: elimina
  WITH deleted AS (
    DELETE FROM user_sessions
    WHERE session_date::timestamp < NOW() - INTERVAL '12 months'
    RETURNING id
  )
  SELECT count(*) INTO v_sessions_del FROM deleted;

  -- 4. Event logs > 12 mesi: elimina
  WITH deleted AS (
    DELETE FROM event_logs
    WHERE created_at < NOW() - INTERVAL '12 months'
    RETURNING id
  )
  SELECT count(*) INTO v_events_del FROM deleted;

  -- 5. Referral IP > 30 giorni: nullifica (consolidamento della migration 20260305150000)
  WITH updated AS (
    UPDATE referrals
    SET source_ip = NULL
    WHERE created_at < NOW() - INTERVAL '30 days'
      AND source_ip IS NOT NULL
    RETURNING id
  )
  SELECT count(*) INTO v_referral_null FROM updated;

  -- Ritorna report per logging
  RETURN jsonb_build_object(
    'executed_at', NOW(),
    'survey_anonymized', v_survey_anon,
    'email_log_deleted', v_email_del,
    'sessions_deleted', v_sessions_del,
    'event_logs_deleted', v_events_del,
    'referral_ip_nullified', v_referral_null
  );
END;
$$;

-- Commento sulla funzione per documentazione
COMMENT ON FUNCTION public.cleanup_expired_data() IS
  'GDPR data retention cleanup. Runs weekly via pg_cron or external scheduler. '
  'Anonymizes survey_responses (24mo), deletes email_log (6mo), '
  'user_sessions (12mo), event_logs (12mo), nullifies referral IPs (30d).';

-- =============================================================================
-- pg_cron scheduling (Supabase Pro+ only)
-- Se pg_cron non e' disponibile (piano Free), questa sezione fallisce
-- silenziosamente e la funzione puo' essere invocata via Edge Function + cron
-- esterno (GitHub Actions, Vercel Cron).
-- =============================================================================
DO $$
BEGIN
  -- Tenta di abilitare pg_cron
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  -- Schedule: ogni domenica alle 03:00 UTC
  PERFORM cron.schedule(
    'weekly-data-retention-cleanup',
    '0 3 * * 0',
    'SELECT public.cleanup_expired_data()'
  );

  RAISE NOTICE 'pg_cron scheduled: weekly-data-retention-cleanup';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available (%). Use external scheduler to call cleanup_expired_data().', SQLERRM;
END $$;
