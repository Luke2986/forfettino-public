
-- Blocco A: Fix FK confirmed_by → ON DELETE SET NULL
ALTER TABLE public.contribution_rewards
  DROP CONSTRAINT IF EXISTS contribution_rewards_confirmed_by_fkey;

ALTER TABLE public.contribution_rewards
  ADD CONSTRAINT contribution_rewards_confirmed_by_fkey
    FOREIGN KEY (confirmed_by) REFERENCES auth.users(id)
    ON DELETE SET NULL;

-- Blocco B: Repair profili orfani
INSERT INTO public.profiles (user_id, first_name, onboarding_completed)
SELECT DISTINCT au.id, 'Utente', true
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = au.id
)
AND (
  EXISTS (SELECT 1 FROM public.fiscal_year_settings fys WHERE fys.user_id = au.id)
  OR EXISTS (SELECT 1 FROM public.receipts r WHERE r.user_id = au.id)
  OR EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = au.id)
  OR EXISTS (SELECT 1 FROM public.tax_schedule ts WHERE ts.user_id = au.id)
  OR EXISTS (SELECT 1 FROM public.payments pm WHERE pm.user_id = au.id)
  OR EXISTS (SELECT 1 FROM public.tool_subscriptions tls WHERE tls.user_id = au.id)
  OR EXISTS (SELECT 1 FROM public.invoices inv WHERE inv.user_id = au.id)
  OR EXISTS (SELECT 1 FROM public.user_sessions us WHERE us.user_id = au.id)
  OR EXISTS (SELECT 1 FROM public.user_contributions uc WHERE uc.user_id = au.id)
)
ON CONFLICT (user_id) DO NOTHING;
