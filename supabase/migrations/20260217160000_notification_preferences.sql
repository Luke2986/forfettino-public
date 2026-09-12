-- ============================================
-- NOTIFICATION PREFERENCES: Preferenze Notifiche per Categoria
-- Story 9.4 — 3 categorie toggle (scadenze, insights, aggiornamenti)
-- ============================================

-- ============================================
-- 1. TABELLA notification_preferences
-- Schema normalizzato: una riga per (user_id, category)
-- Lazy creation: righe create solo al primo toggle dall'utente
-- Default senza riga: scadenze=true, insights=true, aggiornamenti=false
-- ============================================
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('scadenze', 'insights', 'aggiornamenti')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  -- Futuri canali (predisposti, non attivi V1)
  email_enabled BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT false,
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Unique constraint per upsert pattern
  UNIQUE(user_id, category)
);

-- ============================================
-- 2. INDICE
-- ============================================
CREATE INDEX idx_notification_preferences_user_id
  ON public.notification_preferences(user_id);

-- ============================================
-- 3. RLS POLICIES
-- ============================================
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- SELECT: utenti autenticati vedono solo le proprie
CREATE POLICY "Users can view own notification preferences"
  ON public.notification_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- INSERT: utenti autenticati inseriscono solo le proprie
CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: utenti autenticati aggiornano solo le proprie
CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 4. TRIGGER updated_at
-- Riusa la funzione update_updated_at_column() gia' esistente
-- ============================================
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
