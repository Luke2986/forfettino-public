CREATE OR REPLACE FUNCTION public.unmark_tax_schedule_paid(p_schedule_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('unmark_paid_' || v_uid::text || '_' || p_schedule_id::text)
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.tax_schedule
    WHERE id = p_schedule_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Tax schedule not found or not owned by user';
  END IF;

  DELETE FROM public.payments
  WHERE tax_schedule_id = p_schedule_id
    AND user_id = v_uid;

  UPDATE public.tax_schedule
  SET
    total_paid = (
      SELECT COALESCE(SUM(amount), 0)
      FROM public.payments
      WHERE tax_schedule_id = p_schedule_id
    ),
    status = CASE
      WHEN (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE tax_schedule_id = p_schedule_id) >= total_expected THEN 'paid'
      WHEN (SELECT COALESCE(SUM(amount), 0) FROM public.payments WHERE tax_schedule_id = p_schedule_id) > 0 THEN 'partial'
      ELSE 'open'
    END
  WHERE id = p_schedule_id AND user_id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unmark_tax_schedule_paid(UUID) TO authenticated;