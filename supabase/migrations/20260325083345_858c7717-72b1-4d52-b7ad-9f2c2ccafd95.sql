-- Epic 61: user_tasks con campi kanban board

CREATE TABLE IF NOT EXISTS public.user_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  due_date     DATE,
  priority     TEXT NOT NULL DEFAULT 'media'
    CONSTRAINT user_tasks_priority_check CHECK (priority IN ('bassa', 'media', 'alta')),
  status       TEXT NOT NULL DEFAULT 'da_fare'
    CONSTRAINT user_tasks_status_check CHECK (status IN ('in_attesa', 'da_fare', 'in_corso', 'completato')),
  completed_at TIMESTAMPTZ,
  position     INTEGER NOT NULL DEFAULT 0,
  labels       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_id
  ON public.user_tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_status_position
  ON public.user_tasks (user_id, status, position);

-- RLS
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks"
  ON public.user_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks"
  ON public.user_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON public.user_tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON public.user_tasks FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger updated_at automatico
CREATE TRIGGER update_user_tasks_updated_at
  BEFORE UPDATE ON public.user_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();