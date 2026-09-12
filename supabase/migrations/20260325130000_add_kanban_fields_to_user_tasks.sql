-- Add kanban board fields to user_tasks
-- position: ordering within a column (gap-based: 1000, 2000, 3000...)
-- labels: color labels as jsonb array (e.g. ["red","blue"])

ALTER TABLE public.user_tasks
  ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS labels JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Expand status to include 'in_attesa' (backlog/workflow column)
ALTER TABLE public.user_tasks DROP CONSTRAINT IF EXISTS user_tasks_status_check;
ALTER TABLE public.user_tasks
  ADD CONSTRAINT user_tasks_status_check
  CHECK (status IN ('in_attesa', 'da_fare', 'in_corso', 'completato'));

-- Index for efficient column queries (status + position ordering)
CREATE INDEX IF NOT EXISTS idx_user_tasks_status_position
  ON public.user_tasks (user_id, status, position);

-- Backfill positions for existing tasks (order by created_at within each status)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, status ORDER BY created_at) * 1000 AS new_pos
  FROM public.user_tasks
  WHERE position = 0
)
UPDATE public.user_tasks t
SET position = r.new_pos
FROM ranked r
WHERE t.id = r.id;
