-- Cursore persistito per il sync event_logs -> PostHog (`backfill-posthog`).
--
-- PROBLEMA (misurato su PostHog il 2026-08-31): il cron passava
--   body.since = now() - interval '1 day' ad ogni run, ogni 15 minuti. Ogni riga di
--   event_logs veniva quindi rispedita fino a 96 volte al giorno. La dedup per uuid
--   lato PostHog non regge sul path `historical_migration`, quindi i duplicati sono
--   arrivati a destinazione: wizard_step_entered 2338 righe per 806 uuid distinti
--   (2,9x), signup_completed 143 per 50, first_login 62 per 28. Gli eventi nativi
--   del client (income_created 65/65, mark_as_paid_confirmed 13/13) sono puliti:
--   duplicano solo quelli replayati.
--
-- FIX: lo stato di avanzamento vive qui invece di essere ricalcolato ad ogni run.
--   La Edge Function legge il cursore quando il body non contiene `since`, e lo
--   riscrive solo dopo un invio andato a buon fine. Il cron non passa piu' nulla.
--
-- Margine di sicurezza: la EF riparte da cursore - 2 minuti per non perdere righe
--   committate con qualche secondo di ritardo rispetto al loro created_at. L'overlap
--   e' di 2 minuti invece di 24 ore, quindi la superficie di duplicazione residua e'
--   trascurabile e resta coperta dalla dedup uuid.
--
-- Seed a now(): tutto cio' che precede il deploy e' gia' stato spedito (piu' volte).
--   Seedare a 1970 farebbe ripartire il replay dell'intera storia.
--
-- NOTA sui duplicati gia' presenti in PostHog: non sono cancellabili via API. Le
--   query devono contare uniq(person_id) o uniq(uuid), mai count().

CREATE TABLE IF NOT EXISTS public.posthog_backfill_state (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cursor timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Nessuna policy: la tabella e' scritta solo dalla Edge Function in service_role
-- (che bypassa RLS). RLS attiva = nessun accesso da client anon/authenticated.
-- Niente trigger su questa tabella: l'hardening Lovable che blocca le scritture con
-- auth.uid() IS NULL romperebbe il sync.
ALTER TABLE public.posthog_backfill_state ENABLE ROW LEVEL SECURITY;

INSERT INTO public.posthog_backfill_state (id, cursor)
VALUES (1, now())
ON CONFLICT (id) DO NOTHING;

-- Il cron non calcola piu' la finestra: passa un body vuoto e la EF usa il cursore.
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('posthog-backfill-sync');
  EXCEPTION
    WHEN OTHERS THEN NULL; -- job non presente (estensioni non abilitate): ok
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
