
-- Must drop first since return type changes
DROP FUNCTION IF EXISTS public.get_my_contributions();

CREATE FUNCTION public.get_my_contributions()
RETURNS TABLE(feedback_pts BIGINT, referral_pts BIGINT, call_pts BIGINT, first_import_xml_pts BIGINT, welcome_gift_pts BIGINT, admin_manual_pts BIGINT, nps_survey_pts BIGINT, total_pts BIGINT, my_rank BIGINT, monthly_referral_count BIGINT)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
    COALESCE(SUM(points) FILTER (WHERE action_type IN ('nps_survey_completed','pricing_survey_completed','calendar_survey_completed')), 0)
  INTO v_feedback, v_referral, v_call, v_first_import_xml, v_welcome_gift, v_admin_manual, v_nps_survey
  FROM public.user_contributions
  WHERE user_id = v_uid;

  v_total := v_feedback + v_referral + v_call + v_first_import_xml + v_welcome_gift + v_admin_manual + v_nps_survey;

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

  RETURN QUERY SELECT v_feedback, v_referral, v_call, v_first_import_xml, v_welcome_gift, v_admin_manual, v_nps_survey, v_total, v_rank, v_monthly_ref;
END;
$$;

-- Backfill: set last_survey_completed_at for users with existing surveys
UPDATE public.profiles p
SET last_survey_completed_at = sub.last_at
FROM (
  SELECT user_id, MAX(created_at) AS last_at
  FROM public.survey_responses
  GROUP BY user_id
) sub
WHERE p.user_id = sub.user_id
  AND p.last_survey_completed_at IS NULL;
