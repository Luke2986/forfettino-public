-- Admin RLS policy per newsletter_subscribers (Story 71-4)
-- Permette agli admin di leggere tutti i record newsletter
CREATE POLICY "Admins can view all newsletter subscribers"
  ON public.newsletter_subscribers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
