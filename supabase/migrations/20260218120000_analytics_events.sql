-- Analytics Events: contatori aggregati anonimi (ZERO user_id)
-- FR51: analytics aggregati anonimi con base giuridica legittimo interesse
-- FR52: metriche di utilizzo derivabili da tabelle DB esistenti

-- 1. Tabella analytics_events
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name  TEXT NOT NULL,
  count       INTEGER NOT NULL DEFAULT 1,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,

  -- UNIQUE per UPSERT atomico: un record per evento per giorno
  CONSTRAINT analytics_events_event_date_unique UNIQUE (event_name, date),

  -- CHECK: solo eventi validi
  CONSTRAINT analytics_events_event_name_check CHECK (event_name IN (
    'page_view_dashboard',
    'page_view_scadenziario',
    'incasso_creato',
    'scadenza_pagata',
    'onboarding_completato',
    'checklist_dismissed',
    'notifica_letta'
  ))
);

-- 2. Indice per query aggregate veloci
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_date
  ON public.analytics_events (event_name, date);

-- 3. RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- SELECT: solo admin
CREATE POLICY "Admin can read analytics_events"
  ON public.analytics_events
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- INSERT: nessuna policy diretta per utenti — usiamo RPC SECURITY DEFINER
-- (gli utenti incrementano solo tramite la RPC function)

-- 4. RPC function per UPSERT atomico
-- SECURITY DEFINER: gira con i permessi del creatore, bypassa RLS
-- Permette a qualsiasi utente autenticato di incrementare il contatore
CREATE OR REPLACE FUNCTION public.increment_analytics_event(p_event_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate input before INSERT to avoid verbose SQL errors from CHECK constraint
  -- (SECURITY DEFINER context: minimize information leakage)
  IF p_event_name NOT IN (
    'page_view_dashboard', 'page_view_scadenziario', 'incasso_creato',
    'scadenza_pagata', 'onboarding_completato', 'checklist_dismissed', 'notifica_letta'
  ) THEN
    RETURN; -- silently ignore invalid events
  END IF;

  INSERT INTO public.analytics_events (event_name, date, count)
  VALUES (p_event_name, CURRENT_DATE, 1)
  ON CONFLICT (event_name, date)
  DO UPDATE SET count = analytics_events.count + 1;
END;
$$;

-- Grant execute alla funzione per utenti autenticati
GRANT EXECUTE ON FUNCTION public.increment_analytics_event(TEXT) TO authenticated;
