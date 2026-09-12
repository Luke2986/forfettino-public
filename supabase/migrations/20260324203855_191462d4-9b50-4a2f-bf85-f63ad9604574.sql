-- Admin policy: allow admins to view all waitlist entries
CREATE POLICY "Admins can view all waitlist entries"
  ON pro_waitlist FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));