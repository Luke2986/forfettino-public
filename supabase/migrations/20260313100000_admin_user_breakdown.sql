-- Story 41.1: Admin Breakdown azioni per utente nella leaderboard
-- Nuova RPC per ottenere il breakdown contributi per singolo utente (admin only)

CREATE OR REPLACE FUNCTION public.get_admin_user_contribution_breakdown(
  p_user_id UUID
)
RETURNS TABLE (
  action_type TEXT,
  total_points BIGINT,
  action_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin check
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  RETURN QUERY
    SELECT
      uc.action_type,
      SUM(uc.points)::BIGINT AS total_points,
      COUNT(*)::BIGINT AS action_count
    FROM public.user_contributions uc
    WHERE uc.user_id = p_user_id
    GROUP BY uc.action_type
    ORDER BY 2 DESC;
END;
$$;

-- Grant execute to authenticated users (admin check is inside the function)
GRANT EXECUTE ON FUNCTION public.get_admin_user_contribution_breakdown(UUID) TO authenticated;
