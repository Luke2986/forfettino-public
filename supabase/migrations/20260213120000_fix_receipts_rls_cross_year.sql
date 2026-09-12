-- Fix: RLS INSERT policy per receipts - supporto inserimento incassi per anno precedente
-- Bug: la policy precedente contava solo i receipts dell'anno corrente (CURRENT_DATE),
-- ma l'utente Free deve poter inserire incassi anche per l'anno precedente.
-- Il conteggio del limite 10 deve basarsi sull'anno fiscale del receipt inserito,
-- non sull'anno solare corrente.
--
-- In PostgreSQL RLS WITH CHECK per INSERT, le colonne del record inserito
-- sono accessibili direttamente per nome (es. fiscal_year = il valore del nuovo record).

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can insert their own receipts" ON public.receipts;

-- Recreate INSERT policy with correct year-based counting
CREATE POLICY "Users can insert their own receipts"
ON public.receipts
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    -- Admin users: no limit
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND role = 'admin'
    )
    OR
    -- Pro/Studio users: no limit
    EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE subscriptions.user_id = auth.uid()
      AND tier IN ('pro', 'studio')
      AND status IN ('active', 'trialing')
    )
    OR
    -- Free users: count receipts for the SAME fiscal year as the one being inserted
    -- This correctly enforces 10 receipts/year limit regardless of which year
    (
      SELECT COUNT(*) FROM public.receipts AS r
      WHERE r.user_id = auth.uid()
      AND r.fiscal_year = fiscal_year
    ) < 10
  )
);
