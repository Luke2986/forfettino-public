
-- 1) Create nps_campaigns table
CREATE TABLE IF NOT EXISTS public.nps_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  is_active BOOLEAN NOT NULL DEFAULT true,
  cooldown_days INTEGER NOT NULL DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nps_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read active campaigns" ON public.nps_campaigns
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "Admin can manage campaigns" ON public.nps_campaigns
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) Add columns to survey_responses
ALTER TABLE public.survey_responses
  ADD COLUMN IF NOT EXISTS score INTEGER,
  ADD COLUMN IF NOT EXISTS comment TEXT,
  ADD COLUMN IF NOT EXISTS trigger_source TEXT,
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.nps_campaigns(id);

-- 3) Add last_survey_completed_at to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_survey_completed_at TIMESTAMPTZ;
