-- Story 44.2: RPC per recuperare lista email utenti con consenso (admin-only)
-- Usata dal componente AdminSendEmail per batch email via Resend

CREATE OR REPLACE FUNCTION public.get_consented_email_list()
RETURNS TABLE (email TEXT)
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
    SELECT au.email::TEXT
    FROM auth.users au
    JOIN public.profiles p ON p.user_id = au.id
    WHERE p.feedback_email_consent = true
      AND p.is_internal IS NOT TRUE
      AND au.email IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_consented_email_list() TO authenticated;
