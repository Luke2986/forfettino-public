-- Fix: NPS points, is_internal filter on all survey RPCs, split survey columns
-- Problem 1: contribution_action_config NPS may have wrong points (should be 5)
-- Problem 2: record_nps/pricing/calendar_survey_contribution() did not exclude internal users
-- Problem 3: get_my_contributions() lumped all 3 survey types into one nps_survey_pts column
-- Problem 4: revert wrongly awarded points for internal users

----------------------------------------------------------------------
-- 1. Force-reset NPS points to 5 in config
----------------------------------------------------------------------
UPDATE public.contribution_action_config
SET points = 5
WHERE action_type = 'nps_survey_completed';

----------------------------------------------------------------------
-- 2. Recreate NPS RPC with is_internal filter
----------------------------------------------------------------------
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
  FROM public.profiles p WHERE p.user_id = v_uid;

  IF v_is_internal IS TRUE THEN RETURN false; END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_contributions
    WHERE user_id = v_uid AND action_type = 'nps_survey_completed'
  ) THEN RETURN false; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.survey_responses
    WHERE user_id = v_uid AND survey_key = 'nps_v1'
  ) THEN RETURN false; END IF;

  SELECT points INTO v_points
  FROM public.contribution_action_config
  WHERE action_type = 'nps_survey_completed' AND is_active = true;

  IF v_points IS NULL THEN RETURN false; END IF;

  INSERT INTO public.user_contributions (user_id, action_type, points)
  VALUES (v_uid, 'nps_survey_completed', v_points);

  RETURN true;
END;
$$;

----------------------------------------------------------------------
-- 3. Recreate Pricing Survey RPC with is_internal filter
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_pricing_survey_contribution()
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
  PERFORM pg_advisory_xact_lock(hashtext('pricing_survey_' || v_uid::text));

  SELECT p.is_internal INTO v_is_internal
  FROM public.profiles p WHERE p.user_id = v_uid;

  IF v_is_internal IS TRUE THEN RETURN false; END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_contributions
    WHERE user_id = v_uid AND action_type = 'pricing_survey_completed'
  ) THEN RETURN false; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.survey_responses
    WHERE user_id = v_uid AND survey_key = 'pricing_van_westendorp_v1'
  ) THEN RETURN false; END IF;

  SELECT points INTO v_points
  FROM public.contribution_action_config
  WHERE action_type = 'pricing_survey_completed' AND is_active = true;

  IF v_points IS NULL THEN RETURN false; END IF;

  INSERT INTO public.user_contributions (user_id, action_type, points)
  VALUES (v_uid, 'pricing_survey_completed', v_points);

  RETURN true;
END;
$$;

----------------------------------------------------------------------
-- 4. Recreate Calendar Survey RPC with is_internal filter
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_calendar_survey_contribution()
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
  PERFORM pg_advisory_xact_lock(hashtext('calendar_survey_' || v_uid::text));

  SELECT p.is_internal INTO v_is_internal
  FROM public.profiles p WHERE p.user_id = v_uid;

  IF v_is_internal IS TRUE THEN RETURN false; END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_contributions
    WHERE user_id = v_uid AND action_type = 'calendar_survey_completed'
  ) THEN RETURN false; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.survey_responses
    WHERE user_id = v_uid AND survey_key = 'calendar_usage_v1'
  ) THEN RETURN false; END IF;

  SELECT points INTO v_points
  FROM public.contribution_action_config
  WHERE action_type = 'calendar_survey_completed' AND is_active = true;

  IF v_points IS NULL THEN RETURN false; END IF;

  INSERT INTO public.user_contributions (user_id, action_type, points)
  VALUES (v_uid, 'calendar_survey_completed', v_points);

  RETURN true;
END;
$$;

----------------------------------------------------------------------
-- 5. Delete ALL wrongly awarded survey points for internal users
----------------------------------------------------------------------
DELETE FROM public.user_contributions uc
USING public.profiles p
WHERE uc.user_id = p.user_id
  AND p.is_internal IS TRUE
  AND uc.action_type IN (
    'nps_survey_completed',
    'pricing_survey_completed',
    'calendar_survey_completed'
  );

----------------------------------------------------------------------
-- 6. Fix NPS points for non-internal users who got wrong amount
----------------------------------------------------------------------
UPDATE public.user_contributions
SET points = 5
WHERE action_type = 'nps_survey_completed'
  AND points != 5;

----------------------------------------------------------------------
-- 7. Recreate get_my_contributions with SEPARATE survey columns
----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_my_contributions();

CREATE OR REPLACE FUNCTION public.get_my_contributions()
RETURNS TABLE (
  feedback_pts           BIGINT,
  referral_pts           BIGINT,
  call_pts               BIGINT,
  first_import_xml_pts   BIGINT,
  welcome_gift_pts       BIGINT,
  admin_manual_pts       BIGINT,
  nps_survey_pts         BIGINT,
  pricing_survey_pts     BIGINT,
  calendar_survey_pts    BIGINT,
  total_pts              BIGINT,
  my_rank                BIGINT,
  monthly_referral_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_feedback BIGINT;
  v_referral BIGINT;
  v_call BIGINT;
  v_first_import_xml BIGINT;
  v_welcome_gift BIGINT;
  v_admin_manual BIGINT;
  v_nps_survey BIGINT;
  v_pricing_survey BIGINT;
  v_calendar_survey BIGINT;
  v_total BIGINT;
  v_rank BIGINT;
  v_monthly_ref BIGINT;
BEGIN
  SELECT
    COALESCE(SUM(points) FILTER (WHERE action_type = 'feedback_submitted'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'referral_signup'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'call_completed'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'first_import_xml'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'welcome_gift'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'admin_manual'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'nps_survey_completed'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'pricing_survey_completed'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'calendar_survey_completed'), 0)
  INTO v_feedback, v_referral, v_call, v_first_import_xml, v_welcome_gift, v_admin_manual,
       v_nps_survey, v_pricing_survey, v_calendar_survey
  FROM public.user_contributions
  WHERE user_id = v_uid;

  v_total := v_feedback + v_referral + v_call + v_first_import_xml + v_welcome_gift
           + v_admin_manual + v_nps_survey + v_pricing_survey + v_calendar_survey;

  SELECT COUNT(*) + 1 INTO v_rank
  FROM public._contribution_totals() ct
  JOIN public.profiles p ON p.user_id = ct.uid AND p.is_internal IS NOT TRUE
  WHERE ct.total_pts > v_total;

  SELECT COUNT(*) INTO v_monthly_ref
  FROM public.referrals
  WHERE referrer_user_id = v_uid
    AND status IN ('pending', 'confirmed')
    AND created_at >= date_trunc('month', now())
    AND created_at < date_trunc('month', now()) + INTERVAL '1 month';

  RETURN QUERY SELECT v_feedback, v_referral, v_call, v_first_import_xml, v_welcome_gift,
    v_admin_manual, v_nps_survey, v_pricing_survey, v_calendar_survey,
    v_total, v_rank, v_monthly_ref;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_contributions() TO authenticated;
