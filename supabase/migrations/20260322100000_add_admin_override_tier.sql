-- Story 56-1: Admin Override Tier — Accesso PRO manuale e Beta Tester
-- Aggiunge colonna admin_override_tier su profiles per assegnare tier PRO/beta senza Stripe.

-- 1. Colonna nullable con CHECK constraint
ALTER TABLE public.profiles
  ADD COLUMN admin_override_tier TEXT DEFAULT NULL
  CONSTRAINT admin_override_tier_check CHECK (
    admin_override_tier IS NULL OR admin_override_tier IN ('pro', 'beta_tester')
  );

-- 2. Trigger protezione campo: solo admin (o service_role) possono modificare il valore.
-- Pattern identico a protect_is_internal_field (Story 24-1).
-- Se auth.uid() IS NOT NULL e l'utente NON e' admin → il campo resta invariato.
CREATE OR REPLACE FUNCTION public.protect_admin_override_tier()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.admin_override_tier IS DISTINCT FROM NEW.admin_override_tier THEN
    -- Se e' una richiesta autenticata (non service_role/migration)
    IF auth.uid() IS NOT NULL THEN
      -- Controlla se l'utente e' admin
      IF NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'admin'
      ) THEN
        -- Non admin: ripristina il valore originale silenziosamente
        NEW.admin_override_tier := OLD.admin_override_tier;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER protect_profiles_admin_override_tier
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_admin_override_tier();

-- 3. Aggiornare RLS policy receipts INSERT per riconoscere l'override
DROP POLICY IF EXISTS "Users can insert their own receipts" ON public.receipts;

CREATE POLICY "Users can insert their own receipts"
ON public.receipts
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    -- Admin users: no limit
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
    OR
    -- Pro/Studio users via Stripe: no limit
    EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE user_id = auth.uid()
      AND tier IN ('pro', 'studio')
      AND status IN ('active', 'trialing')
    )
    OR
    -- Admin override tier (pro/beta_tester): no limit
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
      AND admin_override_tier IN ('pro', 'beta_tester')
    )
    OR
    -- Free users: check count for current year (limit 5)
    (
      SELECT COUNT(*) FROM public.receipts
      WHERE user_id = auth.uid()
      AND fiscal_year = EXTRACT(YEAR FROM CURRENT_DATE)::integer
    ) < 5
  )
);
