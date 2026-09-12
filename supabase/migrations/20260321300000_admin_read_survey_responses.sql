-- Fix: admin panel cannot read survey_responses from other users.
-- The existing RLS policy only allows users to read their own responses (auth.uid() = user_id).
-- Admin panels (CalendarSurveyResults, PricingSurveyResults, NpsDashboard) need to read ALL responses.
-- Uses the same has_role() pattern as email_log, admin_announcements, etc.

CREATE POLICY "Admin can read all survey responses"
  ON public.survey_responses
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
