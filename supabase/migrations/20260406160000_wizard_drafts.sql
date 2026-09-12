-- Story 70-4: wizard_drafts — Save wizard progress for resume
CREATE TABLE public.wizard_drafts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step_index INT NOT NULL DEFAULT 0,
  visible_steps TEXT[] NOT NULL DEFAULT '{}',
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: 4 standard user-owns-own policies
ALTER TABLE public.wizard_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own draft" ON public.wizard_drafts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own draft" ON public.wizard_drafts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own draft" ON public.wizard_drafts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own draft" ON public.wizard_drafts
  FOR DELETE USING (auth.uid() = user_id);
