-- Sync incrementale Supabase event_logs -> PostHog via pg_cron → Edge Function `backfill-posthog`.
--
-- PERCHE': gli eventi wizard/onboarding/signup partono pre-consenso Cookiebot e NON arrivano a
--   PostHog (vedi supabase/functions/backfill-posthog/index.ts). `track()` li salva sempre su
--   event_logs. Questo cron ripompa a PostHog le righe recenti, in modo idempotente
--   (la EF usa uuid = event_logs.id → PostHog deduplica, ri-run safe).
--
-- Lo schedule collega SOLO il trigger temporale — ZERO logica qui. Tutta la logica (allowlist
--   eventi, mapping distinct_id=user_id, historical_migration) e' nella EF.
--
-- ⚠️ ATTIVAZIONE (step manuali Lovable — NON in questa migration):
--   1. Deploy della EF `backfill-posthog` (sync da main).
--   2. Secret runtime EF: `POSTHOG_PROJECT_KEY` = project API key PostHog (phc_…, la stessa di
--      VITE_POSTHOG_KEY). La EF prova anche VITE_POSTHOG_KEY/POSTHOG_KEY in fallback.
--   3. `net.http_post` gira DENTRO Postgres → non vede i secret del runtime Edge. Il secret per
--      autenticare la chiamata cron→EF si legge a runtime dal Vault. RIUSA lo stesso
--      `cron_secret_pg` gia' creato per 'daily-deadline-reminder-email' (20260627130000). Se non
--      esiste ancora, crearlo UNA volta (SQL editor Lovable, MAI committare il secret reale):
--        SELECT vault.create_secret('<CRON_SECRET reale>', 'cron_secret_pg', 'CRON_SECRET pg_cron');
--      E assicurarsi che la EF `backfill-posthog` abbia l'env `CRON_SECRET` con lo stesso valore
--      (gate X-Cron-Secret in index.ts). Il gate e' FAIL-CLOSED: se CRON_SECRET non e' settato
--      sulla EF la function risponde 500 e il sync si ferma (mai invocabile senza secret).
--   Verifica deploy-gap: SELECT * FROM cron.job WHERE jobname = 'posthog-backfill-sync';
--
-- ⏰ Cadence: ogni 15 min. Lookback `since = now() - 1 day` → finestra ampia che copre eventuali
--   run saltati/outage; la dedup uuid lato PostHog rende l'overlap innocuo. Volume event_logs
--   piccolo → costo trascurabile. Se cresce, restringere la finestra o passare a cursore persistito.
--
-- 🌐 FALLBACK (se pg_net non abilitabile su Lovable): cron esterno (cron-job.org / GitHub Action)
--   POST {SUPABASE_URL}/functions/v1/backfill-posthog con header X-Cron-Secret e body {"since": ...}.

DO $$
BEGIN
  -- ── Estensioni: graceful (su alcuni piani non abilitabili da migration) ──────
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    CREATE EXTENSION IF NOT EXISTS pg_net;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron/pg_net non abilitabili da migration (%). Abilitarli da dashboard Lovable e ri-eseguire lo schedule, OPPURE usare cron esterno (POST /functions/v1/backfill-posthog con header X-Cron-Secret).', SQLERRM;
      RETURN; -- niente schedule senza estensioni
  END;

  -- Unschedule difensivo (idempotenza / ri-applicabilita').
  BEGIN
    PERFORM cron.unschedule('posthog-backfill-sync');
  EXCEPTION
    WHEN OTHERS THEN NULL; -- job non ancora presente: ok
  END;

  -- ── Schedule: NON graceful di proposito ─────────────────────────────────────
  -- Con le estensioni presenti, un errore qui (syntax/permessi/typo) e' un guasto REALE → deve
  -- propagare e far fallire la migration. URL pubblico hard-coded (ALTER DATABASE/ROLE rifiutati
  -- su Lovable Cloud). Secret letto a runtime dal Vault (cifrato a riposo, mai in chiaro nel sorgente).
  -- body.since calcolato ad ogni run (now() corrente).
  PERFORM cron.schedule(
    'posthog-backfill-sync',
    '*/15 * * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://yuyysqpjowieynbqmirj.supabase.co/functions/v1/backfill-posthog',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret_pg')
        ),
        body := jsonb_build_object('since', (now() - interval '1 day')::text)
      )
    $cron$
  );

  RAISE NOTICE 'pg_cron scheduled: posthog-backfill-sync (*/15 * * * *). Verifica: SELECT * FROM cron.job WHERE jobname = ''posthog-backfill-sync''.';
END $$;
