-- Story 67.2: app_settings singleton table for global feature flags
-- First use: device_trust_enabled toggle

CREATE TABLE IF NOT EXISTS public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  device_trust_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Singleton row
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can read, only admin can update
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app_settings"
  ON public.app_settings FOR SELECT USING (true);

CREATE POLICY "Only admin can update app_settings"
  ON public.app_settings FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin')
  );

-- Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION public.app_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.app_settings_updated_at();
