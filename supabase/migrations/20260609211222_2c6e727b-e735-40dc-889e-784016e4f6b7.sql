CREATE OR REPLACE FUNCTION public.get_payment_discrepancy_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT jsonb_build_object(
    'total_marks',      COUNT(*),
    'distinct_users',   COUNT(DISTINCT user_id),
    'green',            COUNT(*) FILTER (WHERE tolerance_band = 'green'),
    'yellow',           COUNT(*) FILTER (WHERE tolerance_band = 'yellow'),
    'red',              COUNT(*) FILTER (WHERE tolerance_band = 'red'),
    'green_percent',    CASE WHEN COUNT(*) > 0
                          THEN ROUND(100.0 * COUNT(*) FILTER (WHERE tolerance_band = 'green') / COUNT(*), 1)
                          ELSE NULL END,
    'reason_given',     COUNT(*) FILTER (WHERE reason_code IS NOT NULL),
    'category_reality', COUNT(*) FILTER (WHERE discrepancy_category = 'reality'),
    'category_engine',  COUNT(*) FILTER (WHERE discrepancy_category = 'engine'),
    'category_unknown', COUNT(*) FILTER (WHERE discrepancy_category = 'unknown')
  )
  INTO v_result
  FROM public.payment_discrepancies;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_payment_discrepancy_stats() TO authenticated;