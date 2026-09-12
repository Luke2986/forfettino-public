-- Epic 26: Leaderboard RPC functions
-- All SECURITY DEFINER to access user_sessions (admin-only RLS)
-- Uses a shared helper function to avoid CTE duplication (review finding #14)

----------------------------------------------------------------------
-- Helper: compute all user totals (contributions + sessions)
-- Used by get_my_contributions, get_leaderboard, get_admin_leaderboard
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
  WITH contribution_points AS (
    SELECT uc.user_id, SUM(uc.points)::BIGINT AS pts
    FROM public.user_contributions uc
    GROUP BY uc.user_id
  ),
  session_points AS (
    SELECT us.user_id, COUNT(DISTINCT us.session_date)::BIGINT AS pts
    FROM public.user_sessions us
    GROUP BY us.user_id
  )
  SELECT
    COALESCE(cp.user_id, sp.user_id) AS uid,
    COALESCE(cp.pts, 0) + COALESCE(sp.pts, 0) AS total_pts
  FROM contribution_points cp
  FULL OUTER JOIN session_points sp ON cp.user_id = sp.user_id;
$$;

-- Internal helper, no direct client access needed
REVOKE ALL ON FUNCTION public._contribution_totals() FROM PUBLIC;

----------------------------------------------------------------------
-- get_my_contributions: personal breakdown for the calling user
-- Optimized: single GROUP BY with FILTER instead of 7 separate queries (#4)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_contributions()
RETURNS TABLE (
  feedback_pts   BIGINT,
  referral_pts   BIGINT,
  call_pts       BIGINT,
  first_receipt_pts BIGINT,
  import_xml_pts BIGINT,
  scadenza_pts   BIGINT,
  session_pts    BIGINT,
  total_pts      BIGINT,
  my_rank        BIGINT
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
  v_first_receipt BIGINT;
  v_import_xml BIGINT;
  v_scadenza BIGINT;
  v_sessions BIGINT;
  v_total BIGINT;
  v_rank BIGINT;
BEGIN
  -- Single query with FILTER clauses instead of 7 separate SELECTs
  SELECT
    COALESCE(SUM(points) FILTER (WHERE action_type = 'feedback_submitted'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'referral_signup'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'call_completed'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'first_receipt'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'import_xml'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'scadenza_paid'), 0)
  INTO v_feedback, v_referral, v_call, v_first_receipt, v_import_xml, v_scadenza
  FROM public.user_contributions
  WHERE user_id = v_uid;

  SELECT COUNT(DISTINCT session_date) INTO v_sessions
  FROM public.user_sessions WHERE user_id = v_uid;

  v_total := v_feedback + v_referral + v_call + v_first_receipt + v_import_xml + v_scadenza + v_sessions;

  -- Compute rank among non-internal users using shared helper
  SELECT COUNT(*) + 1 INTO v_rank
  FROM public._contribution_totals() ct
  JOIN public.profiles p ON p.user_id = ct.uid AND p.is_internal IS NOT TRUE
  WHERE ct.total_pts > v_total;

  RETURN QUERY SELECT v_feedback, v_referral, v_call, v_first_receipt, v_import_xml, v_scadenza, v_sessions, v_total, v_rank;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_contributions() TO authenticated;

----------------------------------------------------------------------
-- get_leaderboard: anonymized leaderboard for all users
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
-- get_admin_leaderboard: full leaderboard with user codes for admin
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_leaderboard(
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  rank       BIGINT,
  user_id    UUID,
  user_code  TEXT,
  first_name TEXT,
  total_pts  BIGINT,
  is_reward_eligible BOOLEAN
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
      ct.total_pts AS total,
      NOT EXISTS (
        SELECT 1 FROM public.contribution_rewards cr
        WHERE cr.user_id = ct.uid
        AND cr.period = TO_CHAR(now(), 'YYYY-MM')
      ) AS eligible
    FROM public._contribution_totals() ct
    JOIN public.profiles p ON p.user_id = ct.uid AND p.is_internal IS NOT TRUE
    WHERE ct.total_pts > 0
  )
  SELECT r.rk, r.uid, r.ucode, r.fname, r.total, r.eligible
  FROM ranked r
  ORDER BY r.rk
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_leaderboard(INTEGER) TO authenticated;
