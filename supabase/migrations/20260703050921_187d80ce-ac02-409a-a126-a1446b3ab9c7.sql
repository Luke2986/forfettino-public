DROP POLICY IF EXISTS "Anyone can read app_settings" ON public.app_settings;
REVOKE SELECT ON public.app_settings FROM anon;
CREATE POLICY "Authenticated users can read app_settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);