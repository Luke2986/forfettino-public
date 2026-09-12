-- Story 84-8: Automazione Cron — invio email scadenza giornaliero + cleanup retention email_events.
--
-- Due parti, una sola migration:
--   1. Schedule pg_cron → invoca la Edge Function `send-deadline-reminder-email` (84-3, già deployata
--      e cron-ready) una volta al giorno. La EF fa tutto il lavoro (selezione rate in soglia
--      [30,7,3,0], dedup `deadline_email_sent`, log `email_log`, invio resiliente, gating consenso).
--      Qui si collega SOLO il trigger temporale — ZERO logica di invio.
--   2. Estende la funzione retention ESISTENTE `cleanup_expired_data()` (già schedulata
--      'weekly-data-retention-cleanup' '0 3 * * 0') per eliminare `email_events` > 6 mesi — cleanup
--      demandato a 84-8 da 84-5 (20260627120000_email_events.sql:11-13). Nessun nuovo cron.
--
-- ⚠️ ATTIVAZIONE (step manuale Lovable — Task 4, NON in questa migration):
--   `net.http_post` gira DENTRO Postgres → non vede i secret del runtime Edge (CRON_SECRET è un
--   env var Deno). Vincoli Lovable Cloud verificati a deploy 2026-06-27:
--     (a) sia `ALTER DATABASE` sia `ALTER ROLE postgres SET ...` sono RIFIUTATI dal tool migration
--         → l'URL (non-secret: è l'URL pubblico del progetto) è HARD-CODED nel comando cron.
--     (b) il secret NON è leggibile da Postgres → va messo nel Vault UNA volta, a mano.
--   Setup (SQL editor Lovable, MAI committare/incollare-in-chat il secret reale):
--     SELECT vault.create_secret('<CRON_SECRET reale>', 'cron_secret_pg', 'CRON_SECRET pg_cron deadline email');
--     -- se 'cron_secret_pg' esiste già:
--     --   SELECT vault.update_secret((SELECT id FROM vault.secrets WHERE name='cron_secret_pg'), '<CRON_SECRET reale>');
--   Lo schedule legge il secret a RUNTIME da vault.decrypted_secrets (cifrato a riposo; il
--   CRON_SECRET non sta MAI in un GUC né nel sorgente). NB: se il CRON_SECRET viene ruotato,
--   aggiornare ENTRAMBI il secret EF e il Vault 'cron_secret_pg' con lo stesso valore.
--   Verifica deploy-gap: SELECT * FROM cron.job WHERE jobname = 'daily-deadline-reminder-email';
--
-- ⏰ ORARIO & DST: pg_cron schedula in UTC. `0 7 * * *` = 07:00 UTC ≈ 09:00 Europe/Rome (CEST estate)
--   / 08:00 (CET inverno). La deriva ±1h è accettabile per un reminder mattutino; la CORRETTEZZA
--   della DATA (e quindi della soglia) è garantita lato EF da `todayRome()` a prescindere dall'ora.
--
-- 🔒 SINGLE-RUNNER: un SOLO schedule giornaliero, nessun overlap/fan-out concorrente. Il dedup
--   (`deadline_email_sent` UNIQUE) è TOCTOU-safe solo con single-runner (index.ts:243-247): due run
--   sovrapposti farebbero fallire la 2ª RIGA, non la 2ª EMAIL.
--
-- 🌐 FALLBACK (non in scope, solo se pg_net non abilitabile su Lovable): cron esterno
--   (cron-job.org / GitHub Action `schedule`) che fa POST {SUPABASE_URL}/functions/v1/
--   send-deadline-reminder-email con header `X-Cron-Secret: <CRON_SECRET>`, schedule `0 7 * * *`.
--   Mirror del blueprint waitlist (20260410100000_create_waitlist_email_sent.sql:65-83).

-- =============================================================================
-- 1. Estende cleanup_expired_data() — aggiunge purge email_events (6 mesi) — AC#8
--    CREATE OR REPLACE: riprende il corpo INTERO della 20260327100000 + il nuovo blocco.
--    NON perdere clausole esistenti (survey/email_log/sessions/event_logs/referral).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_survey_anon       int := 0;
  v_email_del         int := 0;
  v_email_events_del  int := 0;
  v_sessions_del      int := 0;
  v_events_del        int := 0;
  v_referral_null     int := 0;
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

  -- 2b. Email events > 6 mesi: elimina (84-8, demandato da 84-5 — PII: recipient_email + raw_payload)
  WITH deleted AS (
    DELETE FROM email_events
    WHERE created_at < NOW() - INTERVAL '6 months'
    RETURNING id
  )
  SELECT count(*) INTO v_email_events_del FROM deleted;

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
    'email_events_deleted', v_email_events_del,
    'sessions_deleted', v_sessions_del,
    'event_logs_deleted', v_events_del,
    'referral_ip_nullified', v_referral_null
  );
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_data() IS
  'GDPR data retention cleanup. Runs weekly via pg_cron or external scheduler. '
  'Anonymizes survey_responses (24mo), deletes email_log (6mo), email_events (6mo), '
  'user_sessions (12mo), event_logs (12mo), nullifies referral IPs (30d).';

-- =============================================================================
-- 2. Schedule pg_cron → EF send-deadline-reminder-email (giornaliero, 07:00 UTC) — AC#1, #3
--    Scaffold graceful: se pg_cron/pg_net non sono abilitabili da migration (piano/permessi),
--    fallisce silenziosamente con istruzioni (abilitare da dashboard + ri-eseguire schedule).
--    NESSUN secret in chiaro: url + secret via current_setting('app.settings.*') (set in Task 4).
-- =============================================================================
DO $$
BEGIN
  -- ── Estensioni: SOLO questo blocco è graceful ───────────────────────────────
  -- pg_cron (scheduler) + pg_net (net.http_post → HTTP alla EF). Su alcuni piani/permessi
  -- non sono abilitabili da migration → fallback documentato. Se falliscono qui, NON si
  -- prosegue allo schedule (un job senza pg_net non avrebbe senso).
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    CREATE EXTENSION IF NOT EXISTS pg_net;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron/pg_net non abilitabili da migration (%). Abilitarli da dashboard Lovable e ri-eseguire lo schedule, OPPURE usare cron esterno (POST /functions/v1/send-deadline-reminder-email con header X-Cron-Secret, schedule 0 7 * * *).', SQLERRM;
      RETURN; -- niente schedule senza estensioni
  END;

  -- Unschedule difensivo (idempotenza / ri-applicabilità): rimuove un eventuale job omonimo
  -- preesistente prima di ri-crearlo. cron.unschedule lancia se il job non esiste → sotto-blocco.
  BEGIN
    PERFORM cron.unschedule('daily-deadline-reminder-email');
  EXCEPTION
    WHEN OTHERS THEN NULL; -- job non ancora presente: ok
  END;

  -- ── Schedule: NON graceful di proposito ─────────────────────────────────────
  -- Con le estensioni presenti, un errore di cron.schedule (syntax/permessi/typo) è un
  -- guasto REALE → deve propagare e far FALLIRE la migration, non essere mascherato da NOTICE.
  -- Così il successo della migration è prova affidabile che il job esiste (Task 4.3 conferma).
  -- Single-runner giornaliero: 07:00 UTC ≈ 09:00 Europe/Rome (DST ±1h, vedi header).
  -- body '{}' → la EF eredita il default REMINDER_THRESHOLDS = [30,7,3,0] (NO hardcode soglie nel cron).
  -- NB: URL hard-coded (ALTER DATABASE/ROLE rifiutati su Lovable Cloud) — è l'URL pubblico del
  --     progetto, NON un secret. Il secret è letto a runtime dal Vault (vault.decrypted_secrets,
  --     cifrato a riposo — il CRON_SECRET non sta MAI in un GUC né nel sorgente).
  PERFORM cron.schedule(
    'daily-deadline-reminder-email',
    '0 7 * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://yuyysqpjowieynbqmirj.supabase.co/functions/v1/send-deadline-reminder-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret_pg')
        ),
        body := '{}'::jsonb
      )
    $cron$
  );

  RAISE NOTICE 'pg_cron scheduled: daily-deadline-reminder-email (0 7 * * *). Verifica: SELECT * FROM cron.job WHERE jobname = ''daily-deadline-reminder-email''. Ricorda i GUC app.settings.supabase_url/cron_secret (Task 4.1).';
END $$;
