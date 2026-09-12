-- Story 24-1: Filtro Account Interni dalla Admin Dashboard
-- Aggiunge flag is_internal per escludere account di test/sviluppo dalle metriche admin.

ALTER TABLE public.profiles
  ADD COLUMN is_internal BOOLEAN NOT NULL DEFAULT false;

-- Seed: marca i 3 account interni noti
UPDATE public.profiles
SET is_internal = true
WHERE user_code IN ('MB26CJT6N', 'LA269TSP9', 'LB26RSUDR');

-- Protezione: impedisce a utenti regolari di modificare is_internal.
-- auth.uid() IS NOT NULL → richiesta utente autenticato → blocca modifica.
-- auth.uid() IS NULL → service_role / migration → permette modifica.
CREATE OR REPLACE FUNCTION public.protect_is_internal_field()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_internal IS DISTINCT FROM NEW.is_internal AND auth.uid() IS NOT NULL THEN
    NEW.is_internal := OLD.is_internal;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER protect_profiles_is_internal
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_is_internal_field();
