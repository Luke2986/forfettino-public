
-- 4) RPC: record_nps_response
CREATE OR REPLACE FUNCTION public.record_nps_response(
  p_score INTEGER,
  p_comment TEXT DEFAULT NULL,
  p_survey_key TEXT DEFAULT 'nps_v1',
  p_trigger_source TEXT DEFAULT 'in_app',
  p_campaign_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_last TIMESTAMPTZ;
  v_days_since INTEGER;
  v_response_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_score < 0 OR p_score > 10 THEN
    RAISE EXCEPTION 'Score must be between 0 and 10';
  END IF;

  -- Budget check: 60 days cooldown
  SELECT last_survey_completed_at INTO v_last
  FROM public.profiles WHERE user_id = v_uid;

  IF v_last IS NOT NULL THEN
    v_days_since := EXTRACT(DAY FROM (now() - v_last))::INTEGER;
    IF v_days_since < 60 THEN
      RETURN json_build_object('ok', false, 'reason', 'cooldown', 'days_remaining', 60 - v_days_since);
    END IF;
  END IF;

  -- Insert survey response
  INSERT INTO public.survey_responses (user_id, survey_key, selected_reason, score, comment, trigger_source, campaign_id)
  VALUES (v_uid, p_survey_key, 'nps_score_' || p_score::TEXT, p_score, p_comment, p_trigger_source, p_campaign_id)
  RETURNING id INTO v_response_id;

  -- Update last_survey_completed_at
  UPDATE public.profiles SET last_survey_completed_at = now() WHERE user_id = v_uid;

  RETURN json_build_object('ok', true, 'response_id', v_response_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_nps_response TO authenticated;
