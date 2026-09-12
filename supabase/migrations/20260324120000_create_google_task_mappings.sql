-- Epic 53, Story 53-1: Google Task Mappings — Tabella di mapping scadenza-task
-- Mapping tra schedule events Forfettino e Google Tasks per sincronizzazione
-- Autonoma da calendar_connections (Epic 48) — puo' essere creata indipendentemente

----------------------------------------------------------------------
-- 1. CREATE TABLE google_task_mappings
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.google_task_mappings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_event_id  TEXT NOT NULL,
  google_task_id     TEXT NOT NULL,
  google_tasklist_id TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'synced'
    CHECK (status IN ('synced', 'error', 'deleted')),
  last_synced_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, schedule_event_id)
);

----------------------------------------------------------------------
-- 2. Indice per performance query RLS
----------------------------------------------------------------------
CREATE INDEX idx_google_task_mappings_user_id
  ON public.google_task_mappings (user_id);

----------------------------------------------------------------------
-- 3. RLS — auth.uid() = user_id per tutte le operazioni
----------------------------------------------------------------------
ALTER TABLE public.google_task_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task mappings"
  ON public.google_task_mappings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own task mappings"
  ON public.google_task_mappings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own task mappings"
  ON public.google_task_mappings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own task mappings"
  ON public.google_task_mappings FOR DELETE
  USING (auth.uid() = user_id);
