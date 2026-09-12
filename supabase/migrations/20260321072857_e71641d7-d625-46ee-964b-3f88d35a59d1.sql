
-- 1. Drop old CHECK constraint and add updated one with calendar_survey_completed
ALTER TABLE public.user_contributions
  DROP CONSTRAINT IF EXISTS user_contributions_action_type_check;

ALTER TABLE public.user_contributions
  ADD CONSTRAINT user_contributions_action_type_check
  CHECK (action_type IN (
    'feedback_submitted',
    'referral_signup',
    'call_completed',
    'first_import_xml',
    'welcome_gift',
    'admin_manual',
    'pricing_survey_completed',
    'calendar_survey_completed'
  ));

-- 2. Insert action config row
INSERT INTO public.contribution_action_config (
  action_type, points, label, frequency_label, color_bg, color_text, display_order
) VALUES (
  'calendar_survey_completed', 5, 'Survey Calendario', 'una tantum',
  'bg-blue-500', 'text-blue-700', 6
) ON CONFLICT DO NOTHING;

-- 3. Create or replace the RPC function
CREATE OR REPLACE FUNCTION public.record_calendar_survey_contribution()
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_points INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('calendar_survey_' || v_uid::text));

  IF EXISTS (
    SELECT 1 FROM public.user_contributions
    WHERE user_id = v_uid AND action_type = 'calendar_survey_completed'
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.survey_responses
    WHERE user_id = v_uid AND survey_key = 'calendar_usage_v1'
  ) THEN
    RETURN false;
  END IF;

  SELECT points INTO v_points
  FROM public.contribution_action_config
  WHERE action_type = 'calendar_survey_completed' AND is_active = true;

  IF v_points IS NULL THEN RETURN false; END IF;

  INSERT INTO public.user_contributions (user_id, action_type, points)
  VALUES (v_uid, 'calendar_survey_completed', v_points);

  RETURN true;
END;
$function$;

-- 4. Grant execute to authenticated
REVOKE ALL ON FUNCTION public.record_calendar_survey_contribution() FROM public;
GRANT EXECUTE ON FUNCTION public.record_calendar_survey_contribution() TO authenticated;
