-- Welcome Gift: 5 punti di benvenuto per tutti gli utenti
-- - Nuova action type 'welcome_gift'
-- - Trigger automatico per nuovi utenti
-- - RPC aggiornata con welcome_gift_pts

----------------------------------------------------------------------
-- 1. Aggiornare CHECK constraint per includere 'welcome_gift'
----------------------------------------------------------------------
ALTER TABLE public.user_contributions
  DROP CONSTRAINT user_contributions_action_type_check;

ALTER TABLE public.user_contributions
  ADD CONSTRAINT user_contributions_action_type_check CHECK (
    action_type IN (
      'feedback_submitted',
      'referral_signup',
      'call_completed',
      'first_import_xml',
      'welcome_gift'
    )
  );

----------------------------------------------------------------------
-- 2. Seed 'welcome_gift' in contribution_action_config
----------------------------------------------------------------------
INSERT INTO public.contribution_action_config
  (action_type, points, label, frequency_label, color_bg, color_text, display_order)
VALUES
  ('welcome_gift', 5, 'Regalo di benvenuto', 'una tantum', 'bg-emerald-500', 'text-emerald-700', 0)
ON CONFLICT (action_type) DO NOTHING;

----------------------------------------------------------------------
-- 3. Trigger: assegna automaticamente 5 punti ai nuovi utenti
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_welcome_gift()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_contributions (user_id, action_type, points, metadata)
  VALUES (NEW.id, 'welcome_gift', 5, '{"reason":"regalo di benvenuto"}'::jsonb);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_welcome_gift
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_welcome_gift();

----------------------------------------------------------------------
-- 4. Aggiornare get_my_contributions — aggiungere welcome_gift_pts
----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_my_contributions();

CREATE OR REPLACE FUNCTION public.get_my_contributions()
RETURNS TABLE (
  feedback_pts         BIGINT,
  referral_pts         BIGINT,
  call_pts             BIGINT,
  first_import_xml_pts BIGINT,
  welcome_gift_pts     BIGINT,
  total_pts            BIGINT,
  my_rank              BIGINT,
  monthly_referral_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_feedback BIGINT;
  v_referral BIGINT;
  v_call BIGINT;
  v_first_import_xml BIGINT;
  v_welcome_gift BIGINT;
  v_total BIGINT;
  v_rank BIGINT;
  v_monthly_ref BIGINT;
BEGIN
  SELECT
    COALESCE(SUM(points) FILTER (WHERE action_type = 'feedback_submitted'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'referral_signup'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'call_completed'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'first_import_xml'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'welcome_gift'), 0)
  INTO v_feedback, v_referral, v_call, v_first_import_xml, v_welcome_gift
  FROM public.user_contributions
  WHERE user_id = v_uid;

  v_total := v_feedback + v_referral + v_call + v_first_import_xml + v_welcome_gift;

  SELECT COUNT(*) + 1 INTO v_rank
  FROM public._contribution_totals() ct
  JOIN public.profiles p ON p.user_id = ct.uid AND p.is_internal IS NOT TRUE
  WHERE ct.total_pts > v_total;

  SELECT COUNT(*) INTO v_monthly_ref
  FROM public.referrals
  WHERE referrer_user_id = v_uid
    AND status IN ('pending', 'confirmed')
    AND created_at >= date_trunc('month', now())
    AND created_at < date_trunc('month', now()) + INTERVAL '1 month';

  RETURN QUERY SELECT v_feedback, v_referral, v_call, v_first_import_xml, v_welcome_gift, v_total, v_rank, v_monthly_ref;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_contributions() TO authenticated;
