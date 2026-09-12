CREATE OR REPLACE FUNCTION public.get_nsm_adoption_funnel()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  v_current_year INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;
  v_current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

  WITH
  iscritti AS (
    SELECT p.user_id FROM public.profiles p WHERE p.is_internal IS NOT TRUE
  ),
  onboarded AS (
    SELECT user_id FROM iscritti WHERE user_id IN (
      SELECT p.user_id FROM public.profiles p
      WHERE p.is_internal IS NOT TRUE AND p.onboarding_completed = true
    )
  ),
  con_incasso AS (
    SELECT DISTINCT o.user_id FROM onboarded o
    WHERE EXISTS (SELECT 1 FROM public.receipts r WHERE r.user_id = o.user_id)
  ),
  attivi_90gg AS (
    SELECT DISTINCT ci.user_id FROM con_incasso ci
    WHERE EXISTS (
      SELECT 1 FROM public.receipts r
      WHERE r.user_id = ci.user_id AND r.receipt_date >= CURRENT_DATE - 90
    )
  ),
  paymarked_ytd AS (
    SELECT DISTINCT a.user_id FROM attivi_90gg a
    WHERE EXISTS (
      SELECT 1 FROM public.tax_schedule ts
      WHERE ts.user_id = a.user_id
        AND ts.payment_year = v_current_year
        AND (ts.status = 'paid' OR ts.total_paid > 0)
    )
  ),
  onboarded_gestione AS (
    SELECT o.user_id, fys.inps_management
    FROM onboarded o
    LEFT JOIN LATERAL (
      SELECT f.inps_management FROM public.fiscal_year_settings f
      WHERE f.user_id = o.user_id
      ORDER BY CASE WHEN f.fiscal_year = v_current_year THEN 0 ELSE 1 END, f.fiscal_year DESC
      LIMIT 1
    ) fys ON true
  ),
  separata_users AS (SELECT user_id FROM onboarded_gestione WHERE inps_management = 'separata'),
  art_comm_users AS (SELECT user_id FROM onboarded_gestione WHERE inps_management IN ('artigiani','commercianti')),
  sep_con_incasso AS (SELECT user_id FROM con_incasso WHERE user_id IN (SELECT user_id FROM separata_users)),
  sep_attivi_90gg AS (SELECT user_id FROM attivi_90gg WHERE user_id IN (SELECT user_id FROM separata_users)),
  sep_paymarked AS (SELECT user_id FROM paymarked_ytd WHERE user_id IN (SELECT user_id FROM separata_users)),
  ac_con_incasso AS (SELECT user_id FROM con_incasso WHERE user_id IN (SELECT user_id FROM art_comm_users)),
  ac_attivi_90gg AS (SELECT user_id FROM attivi_90gg WHERE user_id IN (SELECT user_id FROM art_comm_users)),
  ac_paymarked AS (SELECT user_id FROM paymarked_ytd WHERE user_id IN (SELECT user_id FROM art_comm_users))
  SELECT json_build_object(
    'fiscal_year', v_current_year,
    'reference_date', CURRENT_DATE,
    'funnel', json_build_array(
      json_build_object('key','iscritti','label','Iscritti','count',(SELECT COUNT(*) FROM iscritti),'percent_of_top',100.0),
      json_build_object('key','onboarded','label','Onboarding completato','count',(SELECT COUNT(*) FROM onboarded),
        'percent_of_top', ROUND((SELECT COUNT(*) FROM onboarded)*100.0 / NULLIF((SELECT COUNT(*) FROM iscritti),0), 1)),
      json_build_object('key','con_incasso','label','Primo incasso','count',(SELECT COUNT(*) FROM con_incasso),
        'percent_of_top', ROUND((SELECT COUNT(*) FROM con_incasso)*100.0 / NULLIF((SELECT COUNT(*) FROM iscritti),0), 1)),
      json_build_object('key','attivi_90gg','label','Attivi (90gg)','count',(SELECT COUNT(*) FROM attivi_90gg),
        'percent_of_top', ROUND((SELECT COUNT(*) FROM attivi_90gg)*100.0 / NULLIF((SELECT COUNT(*) FROM iscritti),0), 1)),
      json_build_object('key','paymarked_ytd','label','Hanno marcato pagato','count',(SELECT COUNT(*) FROM paymarked_ytd),
        'percent_of_top', ROUND((SELECT COUNT(*) FROM paymarked_ytd)*100.0 / NULLIF((SELECT COUNT(*) FROM iscritti),0), 1))
    ),
    'apu_percent', ROUND((SELECT COUNT(*) FROM paymarked_ytd)*100.0 / NULLIF((SELECT COUNT(*) FROM attivi_90gg),0), 1),
    'apu_numerator', (SELECT COUNT(*) FROM paymarked_ytd),
    'apu_denominator', (SELECT COUNT(*) FROM attivi_90gg),
    'by_gestione', json_build_object(
      'separata', json_build_object(
        'funnel', json_build_array(
          json_build_object('key','onboarded','label','Onboarding completato','count',(SELECT COUNT(*) FROM separata_users),'percent_of_top',100.0),
          json_build_object('key','con_incasso','label','Primo incasso','count',(SELECT COUNT(*) FROM sep_con_incasso),
            'percent_of_top', ROUND((SELECT COUNT(*) FROM sep_con_incasso)*100.0 / NULLIF((SELECT COUNT(*) FROM separata_users),0), 1)),
          json_build_object('key','attivi_90gg','label','Attivi (90gg)','count',(SELECT COUNT(*) FROM sep_attivi_90gg),
            'percent_of_top', ROUND((SELECT COUNT(*) FROM sep_attivi_90gg)*100.0 / NULLIF((SELECT COUNT(*) FROM separata_users),0), 1)),
          json_build_object('key','paymarked_ytd','label','Hanno marcato pagato','count',(SELECT COUNT(*) FROM sep_paymarked),
            'percent_of_top', ROUND((SELECT COUNT(*) FROM sep_paymarked)*100.0 / NULLIF((SELECT COUNT(*) FROM separata_users),0), 1))
        ),
        'apu_percent', ROUND((SELECT COUNT(*) FROM sep_paymarked)*100.0 / NULLIF((SELECT COUNT(*) FROM sep_attivi_90gg),0), 1),
        'apu_numerator', (SELECT COUNT(*) FROM sep_paymarked),
        'apu_denominator', (SELECT COUNT(*) FROM sep_attivi_90gg)
      ),
      'art_comm', json_build_object(
        'funnel', json_build_array(
          json_build_object('key','onboarded','label','Onboarding completato','count',(SELECT COUNT(*) FROM art_comm_users),'percent_of_top',100.0),
          json_build_object('key','con_incasso','label','Primo incasso','count',(SELECT COUNT(*) FROM ac_con_incasso),
            'percent_of_top', ROUND((SELECT COUNT(*) FROM ac_con_incasso)*100.0 / NULLIF((SELECT COUNT(*) FROM art_comm_users),0), 1)),
          json_build_object('key','attivi_90gg','label','Attivi (90gg)','count',(SELECT COUNT(*) FROM ac_attivi_90gg),
            'percent_of_top', ROUND((SELECT COUNT(*) FROM ac_attivi_90gg)*100.0 / NULLIF((SELECT COUNT(*) FROM art_comm_users),0), 1)),
          json_build_object('key','paymarked_ytd','label','Hanno marcato pagato','count',(SELECT COUNT(*) FROM ac_paymarked),
            'percent_of_top', ROUND((SELECT COUNT(*) FROM ac_paymarked)*100.0 / NULLIF((SELECT COUNT(*) FROM art_comm_users),0), 1))
        ),
        'apu_percent', ROUND((SELECT COUNT(*) FROM ac_paymarked)*100.0 / NULLIF((SELECT COUNT(*) FROM ac_attivi_90gg),0), 1),
        'apu_numerator', (SELECT COUNT(*) FROM ac_paymarked),
        'apu_denominator', (SELECT COUNT(*) FROM ac_attivi_90gg)
      )
    )
  ) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nsm_adoption_funnel() TO authenticated;