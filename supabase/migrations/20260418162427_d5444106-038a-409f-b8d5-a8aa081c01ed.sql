CREATE OR REPLACE FUNCTION public.get_nsm_adoption_funnel()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  v_signed_up BIGINT;
  v_onboarded BIGINT;
  v_first_receipt BIGINT;
  v_recent_active BIGINT;
  v_with_schedule BIGINT;
  v_apu_percent NUMERIC;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  -- Step 1: signed up (non-internal profiles)
  SELECT COUNT(*)::BIGINT INTO v_signed_up
  FROM public.profiles p
  WHERE p.is_internal IS NOT TRUE;

  -- Step 2: completed onboarding
  SELECT COUNT(*)::BIGINT INTO v_onboarded
  FROM public.profiles p
  WHERE p.is_internal IS NOT TRUE
    AND p.onboarding_completed = true;

  -- Step 3: at least one receipt ever
  SELECT COUNT(DISTINCT p.user_id)::BIGINT INTO v_first_receipt
  FROM public.profiles p
  WHERE p.is_internal IS NOT TRUE
    AND p.onboarding_completed = true
    AND EXISTS (
      SELECT 1 FROM public.receipts r WHERE r.user_id = p.user_id
    );

  -- Step 4: receipt in last 90 days (active)
  SELECT COUNT(DISTINCT p.user_id)::BIGINT INTO v_recent_active
  FROM public.profiles p
  WHERE p.is_internal IS NOT TRUE
    AND p.onboarding_completed = true
    AND EXISTS (
      SELECT 1 FROM public.receipts r
      WHERE r.user_id = p.user_id
        AND r.receipt_date >= (CURRENT_DATE - INTERVAL '90 days')::DATE
    );

  -- Step 5: active + has at least one tax_schedule entry
  SELECT COUNT(DISTINCT p.user_id)::BIGINT INTO v_with_schedule
  FROM public.profiles p
  WHERE p.is_internal IS NOT TRUE
    AND p.onboarding_completed = true
    AND EXISTS (
      SELECT 1 FROM public.receipts r
      WHERE r.user_id = p.user_id
        AND r.receipt_date >= (CURRENT_DATE - INTERVAL '90 days')::DATE
    )
    AND EXISTS (
      SELECT 1 FROM public.tax_schedule ts WHERE ts.user_id = p.user_id
    );

  -- APU percent: with_schedule / signed_up
  v_apu_percent := CASE
    WHEN v_signed_up = 0 THEN NULL
    ELSE ROUND(v_with_schedule * 100.0 / NULLIF(v_signed_up, 0), 1)
  END;

  result := json_build_object(
    'apu_percent', v_apu_percent,
    'apu_count', v_with_schedule,
    'total_signed_up', v_signed_up,
    'reference_date', CURRENT_DATE,
    'funnel', json_build_array(
      json_build_object('step', 'signed_up',     'label', 'Iscritti',                   'count', v_signed_up,     'percent', 100.0),
      json_build_object('step', 'onboarded',     'label', 'Onboarding completato',      'count', v_onboarded,     'percent', CASE WHEN v_signed_up = 0 THEN NULL ELSE ROUND(v_onboarded * 100.0 / NULLIF(v_signed_up, 0), 1) END),
      json_build_object('step', 'first_receipt', 'label', 'Primo incasso',              'count', v_first_receipt, 'percent', CASE WHEN v_signed_up = 0 THEN NULL ELSE ROUND(v_first_receipt * 100.0 / NULLIF(v_signed_up, 0), 1) END),
      json_build_object('step', 'recent_active', 'label', 'Attivi (90gg)',              'count', v_recent_active, 'percent', CASE WHEN v_signed_up = 0 THEN NULL ELSE ROUND(v_recent_active * 100.0 / NULLIF(v_signed_up, 0), 1) END),
      json_build_object('step', 'with_schedule', 'label', 'Con scadenziario fiscale',   'count', v_with_schedule, 'percent', v_apu_percent)
    )
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nsm_adoption_funnel() TO authenticated;