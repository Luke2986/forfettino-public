-- Story 26-4: Leaderboard RPCs v2
-- - _contribution_totals: no more session_daily join
-- - get_my_contributions: 4 columns instead of 7
-- - get_admin_leaderboard: remove is_reward_eligible

----------------------------------------------------------------------
-- Drop existing functions (return type changed, must drop first)
----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_my_contributions();
DROP FUNCTION IF EXISTS public.get_leaderboard(INTEGER);
DROP FUNCTION IF EXISTS public.get_admin_leaderboard(INTEGER);
DROP FUNCTION IF EXISTS public._contribution_totals();

----------------------------------------------------------------------
-- Helper: _contribution_totals (simplified — no session_daily)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._contribution_totals()
RETURNS TABLE (
  uid       UUID,
  total_pts BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT uc.user_id AS uid, SUM(uc.points)::BIGINT AS total_pts
  FROM public.user_contributions uc
  GROUP BY uc.user_id;
$$;

REVOKE ALL ON FUNCTION public._contribution_totals() FROM PUBLIC;

----------------------------------------------------------------------
-- get_my_contributions: 4-action breakdown
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_contributions()
RETURNS TABLE (
  feedback_pts        BIGINT,
  referral_pts        BIGINT,
  call_pts            BIGINT,
  first_import_xml_pts BIGINT,
  total_pts           BIGINT,
  my_rank             BIGINT,
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
  v_total BIGINT;
  v_rank BIGINT;
  v_monthly_ref BIGINT;
BEGIN
  -- Single query with FILTER clauses
  SELECT
    COALESCE(SUM(points) FILTER (WHERE action_type = 'feedback_submitted'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'referral_signup'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'call_completed'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'first_import_xml'), 0)
  INTO v_feedback, v_referral, v_call, v_first_import_xml
  FROM public.user_contributions
  WHERE user_id = v_uid;

  v_total := v_feedback + v_referral + v_call + v_first_import_xml;

  -- Compute rank among non-internal users
  SELECT COUNT(*) + 1 INTO v_rank
  FROM public._contribution_totals() ct
  JOIN public.profiles p ON p.user_id = ct.uid AND p.is_internal IS NOT TRUE
  WHERE ct.total_pts > v_total;

  -- Count referrals (pending + confirmed) created in the current month (UTC)
  SELECT COUNT(*) INTO v_monthly_ref
  FROM public.referrals
  WHERE referrer_user_id = v_uid
    AND status IN ('pending', 'confirmed')
    AND created_at >= date_trunc('month', now())
    AND created_at < date_trunc('month', now()) + INTERVAL '1 month';

  RETURN QUERY SELECT v_feedback, v_referral, v_call, v_first_import_xml, v_total, v_rank, v_monthly_ref;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_contributions() TO authenticated;

----------------------------------------------------------------------
-- get_leaderboard: anonymized (unchanged logic, just uses new _contribution_totals)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_leaderboard(
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  rank       BIGINT,
  user_id    UUID,
  total_pts  BIGINT,
  is_current BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user UUID := auth.uid();
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT
      ROW_NUMBER() OVER (ORDER BY ct.total_pts DESC, ct.uid) AS rk,
      ct.uid,
      ct.total_pts AS total
    FROM public._contribution_totals() ct
    JOIN public.profiles p ON p.user_id = ct.uid AND p.is_internal IS NOT TRUE
    WHERE ct.total_pts > 0
  )
  SELECT
    r.rk AS rank,
    CASE WHEN r.uid = calling_user THEN r.uid ELSE NULL END AS user_id,
    r.total AS total_pts,
    (r.uid = calling_user) AS is_current
  FROM ranked r
  ORDER BY r.rk
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_leaderboard(INTEGER) TO authenticated;

----------------------------------------------------------------------
-- get_admin_leaderboard: removed is_reward_eligible (Premio removed)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_leaderboard(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  rank       BIGINT,
  user_id    UUID,
  user_code  TEXT,
  first_name TEXT,
  total_pts  BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      ROW_NUMBER() OVER (ORDER BY ct.total_pts DESC, ct.uid) AS rk,
      ct.uid,
      p.user_code AS ucode,
      p.first_name AS fname,
      ct.total_pts AS total
    FROM public._contribution_totals() ct
    JOIN public.profiles p ON p.user_id = ct.uid AND p.is_internal IS NOT TRUE
    WHERE ct.total_pts > 0
  )
  SELECT r.rk, r.uid, r.ucode, r.fname, r.total
  FROM ranked r
  ORDER BY r.rk
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_leaderboard(INTEGER) TO authenticated;
