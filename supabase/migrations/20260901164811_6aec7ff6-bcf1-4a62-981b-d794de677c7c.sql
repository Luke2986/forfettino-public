CREATE TABLE IF NOT EXISTS public.posthog_backfill_state (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cursor timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.posthog_backfill_state TO service_role;

ALTER TABLE public.posthog_backfill_state ENABLE ROW LEVEL SECURITY;

INSERT INTO public.posthog_backfill_state (id, cursor)
VALUES (1, now())
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('posthog-backfill-sync');
  EXCEPTION
    WHEN OTHERS THEN NULL;
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
        body := '{}'::jsonb
      )
    $cron$
  );
EXCEPTION
  WHEN undefined_function OR undefined_table OR invalid_schema_name THEN
    RAISE NOTICE 'pg_cron/pg_net non disponibili: riapplicare lo schedule dopo aver abilitato le estensioni.';
END $$;