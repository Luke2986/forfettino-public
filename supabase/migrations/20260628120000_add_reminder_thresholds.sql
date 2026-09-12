-- Story 84-10 — Soglie reminder email personalizzabili per-utente
--
-- Aggiunge `reminder_thresholds`: a quanti giorni dalla scadenza l'utente vuole il
-- promemoria via email. Default = superset cron 84-8 [30,7,3,0] → comportamento
-- identico a oggi per chi non personalizza.
--
-- Decisione B (story §Decisione B): il set ammesso è ESATTAMENTE {30,7,3,0} (le 4
-- soglie del cron). Un array vuoto NON è ammesso (per spegnere il canale = toggle
-- `scadenze_email_enabled`, 84-7). Una soglia fuori-set non sarebbe mai un candidato
-- in `selectSchedulesInThreshold` → scelta non onorata: il CHECK lo impedisce.

ALTER TABLE public.user_notification_settings
  ADD COLUMN IF NOT EXISTS reminder_thresholds INTEGER[] NOT NULL DEFAULT '{30,7,3,0}';

ALTER TABLE public.user_notification_settings
  DROP CONSTRAINT IF EXISTS user_notification_settings_reminder_thresholds_check;

ALTER TABLE public.user_notification_settings
  ADD CONSTRAINT user_notification_settings_reminder_thresholds_check
  CHECK (
    -- non vuoto: almeno una soglia (per togliere tutto si usa il toggle canale 84-7).
    -- NB: `cardinality('{}')` = 0 (rifiutato), mentre `array_length('{}',1)` = NULL → un
    -- CHECK con `array_length(...) >= 1` NON bloccherebbe l'array vuoto (NULL ≠ FALSE).
    cardinality(reminder_thresholds) >= 1
    -- sottoinsieme del superset cron 84-8: `<@` esclude anche i valori fuori-set
    AND reminder_thresholds <@ ARRAY[30, 7, 3, 0]
  );
