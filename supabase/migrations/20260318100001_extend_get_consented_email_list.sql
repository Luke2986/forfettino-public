-- Story 44.3: Estende RPC get_consented_email_list per restituire anche la data del consenso
-- DROP necessario perché il RETURNS TABLE cambia firma (aggiunta colonna consent_at)

DROP FUNCTION IF EXISTS public.get_consented_email_list();

CREATE OR REPLACE FUNCTION public.get_consented_email_list()
RETURNS TABLE (email TEXT, consent_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  RETURN QUERY
    SELECT au.email::TEXT, p.feedback_email_consent_at
    FROM auth.users au
    JOIN public.profiles p ON p.user_id = au.id
    WHERE p.feedback_email_consent = true
      AND p.is_internal IS NOT TRUE
      AND au.email IS NOT NULL
    ORDER BY au.email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_consented_email_list() TO authenticated;
