
-- Revoke from anon, grant only to authenticated
REVOKE ALL ON FUNCTION public.get_public_user_count() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_public_user_count() TO authenticated;
