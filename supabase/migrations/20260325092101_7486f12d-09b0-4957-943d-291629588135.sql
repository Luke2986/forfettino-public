-- ============================================================
-- user_tasks: tabella completa con campi kanban
-- ============================================================

-- 1. Crea tabella se non esiste
CREATE TABLE IF NOT EXISTS public.user_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  due_date      DATE,
  priority      TEXT NOT NULL DEFAULT 'media'
                  CHECK (priority IN ('bassa','media','alta')),
  status        TEXT NOT NULL DEFAULT 'da_fare'
                  CHECK (status IN ('in_attesa','da_fare','in_corso','completato')),
  completed_at  TIMESTAMPTZ,
  position      INTEGER NOT NULL DEFAULT 0,
  labels        JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Aggiungi colonne kanban se la tabella esisteva gia' senza di esse
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_tasks' AND column_name = 'position'
  ) THEN
    ALTER TABLE public.user_tasks ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_tasks' AND column_name = 'labels'
  ) THEN
    ALTER TABLE public.user_tasks ADD COLUMN labels JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 3. Espandi il CHECK constraint su status per includere 'in_attesa'
DO $$
BEGIN
  ALTER TABLE public.user_tasks DROP CONSTRAINT IF EXISTS user_tasks_status_check;
  ALTER TABLE public.user_tasks ADD CONSTRAINT user_tasks_status_check
    CHECK (status IN ('in_attesa','da_fare','in_corso','completato'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. Indice per query kanban
CREATE INDEX IF NOT EXISTS idx_user_tasks_kanban
  ON public.user_tasks (user_id, status, position);

-- 5. RLS
ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_crud_own_tasks" ON public.user_tasks;
CREATE POLICY "users_crud_own_tasks" ON public.user_tasks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_tasks_updated_at ON public.user_tasks;
CREATE TRIGGER trg_user_tasks_updated_at
  BEFORE UPDATE ON public.user_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();