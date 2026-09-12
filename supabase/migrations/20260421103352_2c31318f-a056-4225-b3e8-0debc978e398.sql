-- Fix RLS INSERT policy on receipts: enforce per-source + per-fiscal_year limits

CREATE OR REPLACE FUNCTION public.check_receipt_insert_limit(
  _user_id uuid,
  _fiscal_year integer,
  _source text
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_manual_count INTEGER;
  v_xml_count INTEGER;
  v_total_count INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
    AND tier IN ('pro', 'studio')
    AND status IN ('active', 'trialing')
  ) THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
    AND admin_override_tier IN ('pro', 'beta_tester')
  ) THEN
    RETURN TRUE;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE source = 'manual'),
    COUNT(*) FILTER (WHERE source = 'xml_import'),
    COUNT(*)
  INTO v_manual_count, v_xml_count, v_total_count
  FROM public.receipts
  WHERE user_id = _user_id
    AND fiscal_year = _fiscal_year;

  IF _source = 'manual' AND v_manual_count >= 5 THEN
    RETURN FALSE;
  END IF;

  IF _source = 'xml_import' AND v_xml_count >= 3 THEN
    RETURN FALSE;
  END IF;

  IF v_total_count >= 8 THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_receipt_insert_limit(uuid, integer, text) TO authenticated;

DROP POLICY IF EXISTS "Users can insert their own receipts" ON public.receipts;

CREATE POLICY "Users can insert their own receipts"
ON public.receipts
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND public.check_receipt_insert_limit(user_id, fiscal_year, source)
);