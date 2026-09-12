-- Repair: ricrea profili minimi per utenti "zombie" — autenticabili in auth.users
-- ma con riga profiles mancante (causata da delete-account parziale).
-- Il wizard loop si verifica perché ProtectedRoute vede !profile → redirect wizard.
--
-- Logica: se un user_id ha dati in QUALSIASI tabella utente ma NON ha riga in profiles,
-- inserisci un profilo minimo con onboarding_completed = true.
-- user_code viene generato automaticamente dal trigger DB esistente.

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
