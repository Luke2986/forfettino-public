ALTER TABLE public.user_notification_settings
  ADD COLUMN IF NOT EXISTS reminder_thresholds INTEGER[] NOT NULL DEFAULT '{30,7,3,0}';

ALTER TABLE public.user_notification_settings
  DROP CONSTRAINT IF EXISTS user_notification_settings_reminder_thresholds_check;

ALTER TABLE public.user_notification_settings
  ADD CONSTRAINT user_notification_settings_reminder_thresholds_check
  CHECK (cardinality(reminder_thresholds) >= 1 AND reminder_thresholds <@ ARRAY[30, 7, 3, 0]);