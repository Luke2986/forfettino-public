-- Aggiungi le colonne mancanti se la tabella esiste già con schema incompleto
ALTER TABLE public.nps_campaigns
  ADD COLUMN IF NOT EXISTS enabled_triggers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS repeat_interval TEXT NOT NULL DEFAULT 'never'
    CHECK (repeat_interval IN ('never', '3m', '6m', '12m')),
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE;

-- Seed della prima campagna
INSERT INTO public.nps_campaigns (name, is_active, enabled_triggers, repeat_interval, start_date, end_date)
VALUES (
  'Default NPS Campaign',
  true,
  '["third_receipt", "30days_active", "calendar_2nd_visit", "wizard_plus_receipt", "post_deadline", "milestone_reached"]'::jsonb,
  'never',
  NULL,
  NULL
)
ON CONFLICT DO NOTHING;