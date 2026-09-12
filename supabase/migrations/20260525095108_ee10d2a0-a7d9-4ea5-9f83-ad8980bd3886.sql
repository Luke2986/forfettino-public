-- Rimuove la policy INSERT permissiva su waitlist_leads.
-- Gli insert validi avvengono via RPC SECURITY DEFINER join_waitlist_lead,
-- che bypassa RLS ed è l'unico canale autorizzato.
DROP POLICY IF EXISTS "Insert via RPC only" ON public.waitlist_leads;