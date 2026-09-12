
-- 1. Create app_settings table
CREATE TABLE public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  device_trust_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_settings_singleton CHECK (id = 1)
);

-- 2. Insert singleton row
INSERT INTO public.app_settings (id, device_trust_enabled) VALUES (1, true);

-- 3. Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 4. SELECT policy: anyone authenticated can read
CREATE POLICY "Anyone can read app_settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

-- 5. UPDATE policy: only admins
CREATE POLICY "Admins can update app_settings"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Trigger to auto-set updated_at
CREATE OR REPLACE FUNCTION public.set_app_settings_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_app_settings_updated_at();
