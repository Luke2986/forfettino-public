DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    CREATE EXTENSION IF NOT EXISTS pg_net;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron/pg_net non abilitabili (%)', SQLERRM;
    RETURN;
  END;

  BEGIN
    PERFORM cron.unschedule('posthog-backfill-sync');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

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
END $$;