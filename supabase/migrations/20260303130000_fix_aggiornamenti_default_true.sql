-- Migration: fix aggiornamenti_enabled default
-- Bug fix: DB default was false but the app treats it as true (opt-out model).
-- This caused broadcast notifications to be silently blocked for users who had
-- a user_notification_settings row created via upsert (Bug 2+3).

-- 1. Fix the column default from false → true
ALTER TABLE public.user_notification_settings
  ALTER COLUMN aggiornamenti_enabled SET DEFAULT true;

-- 2. Repair existing rows: set aggiornamenti_enabled = true for all users
-- who currently have false (which was the wrong DB default, not an explicit opt-out).
-- Since the UI never allowed toggling this to false (it was always shown as true),
-- ALL false values are from the bad DB default.
UPDATE public.user_notification_settings
SET aggiornamenti_enabled = true, updated_at = now()
WHERE aggiornamenti_enabled = false;
