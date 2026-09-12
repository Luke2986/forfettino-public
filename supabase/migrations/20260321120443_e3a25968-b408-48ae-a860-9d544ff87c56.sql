CREATE OR REPLACE FUNCTION public.record_nps_survey_contribution()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_points INTEGER;
  v_is_internal BOOLEAN;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('nps_survey_' || v_uid::text));

  SELECT p.is_internal INTO v_is_internal
  FROM public.profiles p
  WHERE p.user_id = v_uid;

  IF v_is_internal IS TRUE THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_contributions
    WHERE user_id = v_uid AND action_type = 'nps_survey_completed'
  ) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.survey_responses
    WHERE user_id = v_uid AND survey_key = 'nps_v1'
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