
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

DO $$
BEGIN
  ALTER TABLE public.user_tasks DROP CONSTRAINT IF EXISTS user_tasks_status_check;
  ALTER TABLE public.user_tasks ADD CONSTRAINT user_tasks_status_check
    CHECK (status IN ('in_attesa','da_fare','in_corso','completato'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_tasks_kanban
  ON public.user_tasks (user_id, status, position);

ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_crud_own_tasks" ON public.user_tasks;
CREATE POLICY "users_crud_own_tasks" ON public.user_tasks
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_user_tasks_updated_at ON public.user_tasks;
CREATE TRIGGER trg_user_tasks_updated_at
  BEFORE UPDATE ON public.user_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
