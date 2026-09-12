-- Migration: user_notification_settings
-- Story 25.3 — Preferenze Notifiche Espanse
-- New table for expanded notification preferences (replaces notification_preferences logically)
-- Coexists with notification_preferences for backward compatibility

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.user_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  master_enabled BOOLEAN NOT NULL DEFAULT true,
  tone TEXT NOT NULL DEFAULT 'neutro' CHECK (tone IN ('rassicurante', 'neutro', 'minimalista')),
  has_accountant BOOLEAN NOT NULL DEFAULT false,
  scadenze_enabled BOOLEAN NOT NULL DEFAULT true,
  feedback_enabled BOOLEAN NOT NULL DEFAULT true,
  insights_enabled BOOLEAN NOT NULL DEFAULT true,
  admin_messages_enabled BOOLEAN NOT NULL DEFAULT true,
  aggiornamenti_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. RLS policies
ALTER TABLE public.user_notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification settings"
  ON public.user_notification_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification settings"
  ON public.user_notification_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification settings"
  ON public.user_notification_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Trigger updated_at (reuse existing function)
CREATE TRIGGER update_user_notification_settings_updated_at
  BEFORE UPDATE ON public.user_notification_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
