-- Reduce free tier receipt limit from 10 to 5 per fiscal year
-- XML import limit (3) is enforced client-side only via FREE_IMPORT_LIMIT constant

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
    -- Pro/Studio users: no limit
    EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE user_id = auth.uid()
      AND tier IN ('pro', 'studio')
      AND status IN ('active', 'trialing')
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
