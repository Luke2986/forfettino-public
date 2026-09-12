-- Add RLS policy to enforce Free tier receipt limits server-side
-- This prevents bypassing the 10 receipts/year limit via direct API calls

-- First, drop the existing INSERT policy and recreate with tier check
DROP POLICY IF EXISTS "Users can insert their own receipts" ON public.receipts;

-- Create new INSERT policy that enforces subscription tier limits
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
    -- Free users: check count for current year (limit 10)
    (
      SELECT COUNT(*) FROM public.receipts 
      WHERE user_id = auth.uid() 
      AND fiscal_year = EXTRACT(YEAR FROM CURRENT_DATE)::integer
    ) < 10
  )
);