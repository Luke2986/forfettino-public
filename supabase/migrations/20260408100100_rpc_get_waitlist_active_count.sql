-- RPC: get_waitlist_active_count — conteggio aggregato waitlist (social proof)
-- Conta pro_waitlist attivi + waitlist_leads con dedup email

CREATE OR REPLACE FUNCTION public.get_waitlist_active_count()
RETURNS INT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT (
    SELECT count(*)::int FROM pro_waitlist WHERE revoked_at IS NULL
  ) + (
    SELECT count(*)::int FROM waitlist_leads wl
    WHERE NOT EXISTS (
      SELECT 1 FROM pro_waitlist pw
      WHERE lower(pw.email) = lower(wl.email)
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_waitlist_active_count() TO anon, authenticated;
