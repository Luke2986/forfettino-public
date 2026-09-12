-- RPC function: get_public_user_count
-- Returns the count of external (non-internal) authenticated users.
-- SECURITY DEFINER to bypass RLS on profiles table.
-- Only callable by authenticated users.

CREATE OR REPLACE FUNCTION public.get_public_user_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.profiles
  WHERE is_internal IS NOT TRUE;
$$;

-- Grant execute to authenticated users only (not anon)
GRANT EXECUTE ON FUNCTION public.get_public_user_count() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_public_user_count() FROM anon;
