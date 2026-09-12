
-- 5) Extend CHECK constraint for nps_survey_completed
ALTER TABLE public.user_contributions DROP CONSTRAINT IF EXISTS user_contributions_action_type_check;
ALTER TABLE public.user_contributions ADD CONSTRAINT user_contributions_action_type_check
  CHECK (action_type IN ('feedback_submitted','referral_signup','call_completed','first_import_xml','welcome_gift','admin_manual','pricing_survey_completed','calendar_survey_completed','nps_survey_completed'));

-- 6) Insert nps_survey_completed config
INSERT INTO public.contribution_action_config (action_type, points, label, frequency_label, color_bg, color_text, display_order)
VALUES ('nps_survey_completed', 5, 'Survey NPS', 'una tantum', 'bg-emerald-500', 'text-emerald-700', 7)
ON CONFLICT DO NOTHING;

-- 7) RPC: record_nps_survey_contribution
CREATE OR REPLACE FUNCTION public.record_nps_survey_contribution()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_points INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('nps_survey_' || v_uid::text));

  IF EXISTS (
    SELECT 1 FROM public.user_contributions
    WHERE user_id = v_uid AND action_type = 'nps_survey_completed'
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.survey_responses
    WHERE user_id = v_uid AND score IS NOT NULL
  ) THEN
    RETURN false;
  END IF;

  SELECT points INTO v_points
  FROM public.contribution_action_config
  WHERE action_type = 'nps_survey_completed' AND is_active = true;

  IF v_points IS NULL THEN RETURN false; END IF;

  INSERT INTO public.user_contributions (user_id, action_type, points)
  VALUES (v_uid, 'nps_survey_completed', v_points);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_nps_survey_contribution TO authenticated;
