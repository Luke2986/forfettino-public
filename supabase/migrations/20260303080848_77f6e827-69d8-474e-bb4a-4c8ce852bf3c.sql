
-- Blocco A: Fix FK contribution_rewards.confirmed_by → ON DELETE SET NULL
ALTER TABLE public.contribution_rewards
  DROP CONSTRAINT IF EXISTS contribution_rewards_confirmed_by_fkey;

ALTER TABLE public.contribution_rewards
  ADD CONSTRAINT contribution_rewards_confirmed_by_fkey
  FOREIGN KEY (confirmed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Blocco B: Repair profili orfani con dati storici
-- Inserisce profilo minimo per utenti che hanno dati ma non hanno riga in profiles
INSERT INTO public.profiles (user_id, first_name, onboarding_completed)
SELECT DISTINCT u.id, 'Utente', true
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id)
  AND (
    EXISTS (SELECT 1 FROM public.fiscal_year_settings fys WHERE fys.user_id = u.id) OR
    EXISTS (SELECT 1 FROM public.receipts r WHERE r.user_id = u.id) OR
    EXISTS (SELECT 1 FROM public.clients c WHERE c.user_id = u.id) OR
    EXISTS (SELECT 1 FROM public.tax_schedule ts WHERE ts.user_id = u.id) OR
    EXISTS (SELECT 1 FROM public.tool_subscriptions tsub WHERE tsub.user_id = u.id) OR
    EXISTS (SELECT 1 FROM public.invoices i WHERE i.user_id = u.id) OR
    EXISTS (SELECT 1 FROM public.invoice_payments ip WHERE ip.user_id = u.id) OR
    EXISTS (SELECT 1 FROM public.installment_plans ipl WHERE ipl.user_id = u.id) OR
    EXISTS (SELECT 1 FROM public.payments pay WHERE pay.user_id = u.id) OR
    EXISTS (SELECT 1 FROM public.user_contributions uc WHERE uc.user_id = u.id)
  );
