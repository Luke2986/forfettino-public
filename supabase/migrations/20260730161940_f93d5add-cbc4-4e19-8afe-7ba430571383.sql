CREATE OR REPLACE FUNCTION public.protect_admin_override_tier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_claims text;
  v_jwt_role text;
BEGIN
  IF OLD.admin_override_tier IS NOT DISTINCT FROM NEW.admin_override_tier THEN
    RETURN NEW;
  END IF;

  v_claims := nullif(current_setting('request.jwt.claims', true), '');

  IF v_claims IS NULL THEN
    RETURN NEW;
  END IF;

  v_jwt_role := v_claims::jsonb ->> 'role';

  IF v_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permission denied: admin_override_tier can only be modified by administrators'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.protect_is_internal_field()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_claims text;
  v_jwt_role text;
BEGIN
  IF OLD.is_internal IS NOT DISTINCT FROM NEW.is_internal THEN
    RETURN NEW;
  END IF;

  v_claims := nullif(current_setting('request.jwt.claims', true), '');

  IF v_claims IS NULL THEN
    RETURN NEW;
  END IF;

  v_jwt_role := v_claims::jsonb ->> 'role';

  IF v_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permission denied: is_internal can only be modified by administrators'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS protect_profiles_admin_override_tier ON public.profiles;
CREATE TRIGGER protect_profiles_admin_override_tier
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_admin_override_tier();

DROP TRIGGER IF EXISTS protect_profiles_is_internal ON public.profiles;
CREATE TRIGGER protect_profiles_is_internal
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_is_internal_field();