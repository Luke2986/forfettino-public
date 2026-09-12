-- FIX: ripristina la possibilita' di assegnare PRO/Beta Tester dal pannello admin.
--
-- Regressione introdotta da 20260609202551 (hardening security): i trigger di protezione
-- sono passati da "silent revert" a RAISE EXCEPTION con la condizione
--   IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin')
-- Ma l'UNICO writer di admin_override_tier e' la edge function admin-set-override-tier,
-- che scrive con il SERVICE ROLE → auth.uid() e' NULL → EXCEPTION 42501 sempre.
-- Stesso blocco per SQL diretto (SQL editor / migrazioni), dove auth.uid() e' NULL.
-- Risultato: nessun percorso poteva piu' modificare il campo (RLS profiles consente
-- UPDATE solo sulla propria riga, quindi un admin non puo' nemmeno passare dal client).
--
-- Fix: il contesto service_role e il contesto SQL diretto sono considerati fidati
-- (il service role bypassa comunque tutta la RLS, e la edge function fa gia' il suo
-- controllo has_role sul chiamante). Per le richieste con JWT utente resta il blocco
-- hard: solo admin, altrimenti EXCEPTION.

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

  -- Nessun JWT: SQL diretto (migrazioni, SQL editor, job interni) → consentito
  IF v_claims IS NULL THEN
    RETURN NEW;
  END IF;

  v_jwt_role := v_claims::jsonb ->> 'role';

  -- service_role: edge function admin-set-override-tier (verifica has_role sul chiamante)
  IF v_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Richiesta con JWT utente: solo admin
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permission denied: admin_override_tier can only be modified by administrators'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

-- Stessa identica regressione su is_internal (introdotta dalla stessa migrazione):
-- il flag non era piu' modificabile ne' da service role ne' da SQL editor.
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

-- Il trigger protect_profiles_admin_override_tier esiste gia' (20260322100000).
-- Ricreato in modo idempotente per sicurezza: se manca sul DB, il campo resterebbe
-- scrivibile da chiunque abbia UPDATE sulla propria riga profiles.
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
