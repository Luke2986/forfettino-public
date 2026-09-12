-- Fix: get_admin_leaderboard gains p_include_internal parameter.
-- When true, internal users are included in the leaderboard.

DROP FUNCTION IF EXISTS public.get_admin_leaderboard(INTEGER);

CREATE OR REPLACE FUNCTION public.get_admin_leaderboard(
  p_limit            INTEGER DEFAULT 50,
  p_include_internal BOOLEAN DEFAULT false
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
    JOIN public.profiles p ON p.user_id = ct.uid
    WHERE ct.total_pts > 0
      AND (p_include_internal OR p.is_internal IS NOT TRUE)
  )
  SELECT r.rk, r.uid, r.ucode, r.fname, r.total
  FROM ranked r
  ORDER BY r.rk
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_leaderboard(INTEGER, BOOLEAN) TO authenticated;
