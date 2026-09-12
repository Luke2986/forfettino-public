-- ============================================
-- NOTIFICATIONS: Centro Notifiche In-App
-- Story 9.2 — Schema DB e infrastruttura notifiche
-- ============================================

-- ============================================
-- 1. TABELLA notifications
-- ============================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Tipologia e categoria
  type TEXT NOT NULL,              -- sottotipo: 'deadline_reminder_7d', 'deadline_reminder_3d', 'deadline_today', 'rate_scaduta', 'digest_mensile', 'system_update'
  category TEXT NOT NULL CHECK (category IN ('scadenze', 'insights', 'aggiornamenti')),

  -- Contenuto
  title TEXT NOT NULL,             -- es. "Scadenza tra 7 giorni"
  body TEXT NOT NULL,              -- es. "Rata INPS Q1 di 1.234 scade il 16/02/2026"

  -- Stato lettura
  read_at TIMESTAMPTZ,             -- NULL = non letta

  -- Azione opzionale
  action_url TEXT,                 -- es. '/scadenziario'
  action_label TEXT,               -- es. 'Vai allo Scadenziario'

  -- Dati estensibili
  metadata JSONB,                  -- { deadline_id, fiscal_year, amount, ... }

  -- Canali futuri (predisposti, non attivi)
  email_sent_at TIMESTAMPTZ,       -- NULL
  sms_sent_at TIMESTAMPTZ,         -- NULL

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 2. INDICI
-- ============================================
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- ============================================
-- 3. RLS POLICIES
-- ============================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- SELECT: utenti autenticati vedono solo le proprie
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- UPDATE: utenti autenticati aggiornano solo le proprie (per mark as read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Nessuna policy INSERT per utenti normali — solo service_role (Edge Functions) puo' inserire

-- ============================================
-- 4. TRIGGER updated_at
-- ============================================
CREATE TRIGGER update_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
