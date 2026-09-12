-- Story 41.2: Admin export utenti qualificati con email
-- RPC per esportare utenti con >= N incassi, con filtro GDPR email consent

CREATE OR REPLACE FUNCTION public.get_admin_qualified_users(
  p_min_receipts INTEGER DEFAULT 3
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  first_name TEXT,
  user_code TEXT,
  receipt_count BIGINT,
  inps_type TEXT,
  created_at TIMESTAMPTZ,
  email_consent BOOLEAN
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

  -- Security: prevent enumeration of all users with threshold 0
  IF p_min_receipts < 1 THEN
    RAISE EXCEPTION 'p_min_receipts must be >= 1';
  END IF;

  RETURN QUERY
    SELECT
      p.user_id,
      au.email::TEXT,
      p.first_name,
      p.user_code,
      rc.cnt AS receipt_count,
      fr.inps_type,
      p.created_at,
      p.feedback_email_consent AS email_consent
    FROM (
      SELECT r.user_id, COUNT(*)::BIGINT AS cnt
      FROM public.receipts r
      GROUP BY r.user_id
      HAVING COUNT(*) >= p_min_receipts
    ) rc
    JOIN public.profiles p ON p.user_id = rc.user_id
    JOIN auth.users au ON au.id = p.user_id
    LEFT JOIN LATERAL (
      SELECT frl.inps_type
      FROM public.fiscal_rules frl
      WHERE frl.user_id = p.user_id
      ORDER BY frl.fiscal_year DESC
      LIMIT 1
    ) fr ON true
    WHERE p.is_internal IS NOT TRUE
      AND p.feedback_email_consent = true
    ORDER BY 5 DESC, 7 ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_qualified_users(INTEGER) TO authenticated;
