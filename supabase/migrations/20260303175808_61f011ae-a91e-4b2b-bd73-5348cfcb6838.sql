-- Fix: contribution_action_config has a points_check constraint (points > 0)
-- Use points = 1 as placeholder for admin_manual (actual points come from RPC params)

-- Re-apply CHECK constraint (idempotent - drop if exists, re-add)
ALTER TABLE public.user_contributions
  DROP CONSTRAINT IF EXISTS user_contributions_action_type_check;

ALTER TABLE public.user_contributions
  ADD CONSTRAINT user_contributions_action_type_check CHECK (
    action_type IN (
      'feedback_submitted',
      'referral_signup',
      'call_completed',
      'first_import_xml',
      'welcome_gift',
      'admin_manual'
    )
  );

-- Seed admin_manual with points=1 (placeholder, actual points from RPC)
INSERT INTO public.contribution_action_config
  (action_type, points, label, frequency_label, color_bg, color_text, display_order, is_active)
VALUES
  ('admin_manual', 1, 'Punti admin', 'senza limiti', 'bg-slate-500', 'text-slate-700', 99, true)
ON CONFLICT (action_type) DO NOTHING;

-- RPC admin_award_contribution
CREATE OR REPLACE FUNCTION public.admin_award_contribution(
  p_user_code   TEXT    DEFAULT NULL,
  p_action_type TEXT    DEFAULT 'admin_manual',
  p_points      INTEGER DEFAULT NULL,
  p_reason      TEXT    DEFAULT NULL,
  p_all_users   BOOLEAN DEFAULT false
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_user_id UUID;
  v_points INTEGER;
  v_metadata JSONB;
  v_inserted INTEGER := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('award_' || COALESCE(p_user_code, 'all'))
  );

  IF p_action_type = 'admin_manual' THEN
    IF p_points IS NULL OR p_points <= 0 THEN
      RAISE EXCEPTION 'p_points obbligatorio e > 0 per admin_manual';
    END IF;
    v_points := p_points;
  ELSE
    SELECT points INTO v_points
    FROM public.contribution_action_config
    WHERE action_type = p_action_type AND is_active = true;

    IF v_points IS NULL THEN
      RAISE EXCEPTION 'action_type "%" non trovato o disattivato', p_action_type;
    END IF;
  END IF;

  v_metadata := jsonb_build_object(
    'awarded_by', auth.uid(),
    'awarded_at', now()::text
  );
  IF p_reason IS NOT NULL AND p_reason != '' THEN
    v_metadata := v_metadata || jsonb_build_object('reason', p_reason);
  END IF;
  IF p_all_users THEN
    v_metadata := v_metadata || jsonb_build_object('bulk', true);
  END IF;

  IF p_all_users THEN
    WITH inserted AS (
      INSERT INTO public.user_contributions (user_id, action_type, points, metadata)
      SELECT p.user_id, p_action_type, v_points, v_metadata
      FROM public.profiles p
      WHERE p.is_internal IS NOT TRUE
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_inserted FROM inserted;
  ELSE
    IF p_user_code IS NULL OR TRIM(p_user_code) = '' THEN
      RAISE EXCEPTION 'p_user_code obbligatorio per assegnazione singola';
    END IF;

    SELECT p.user_id INTO v_target_user_id
    FROM public.profiles p
    WHERE p.user_code = UPPER(TRIM(p_user_code));

    IF v_target_user_id IS NULL THEN
      RAISE EXCEPTION 'Utente con codice "%" non trovato', p_user_code;
    END IF;

    INSERT INTO public.user_contributions (user_id, action_type, points, metadata)
    VALUES (v_target_user_id, p_action_type, v_points, v_metadata);

    v_inserted := 1;
  END IF;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_award_contribution(TEXT, TEXT, INTEGER, TEXT, BOOLEAN) TO authenticated;

-- Aggiornare get_my_contributions con admin_manual_pts
DROP FUNCTION IF EXISTS public.get_my_contributions();

CREATE OR REPLACE FUNCTION public.get_my_contributions()
RETURNS TABLE (
  feedback_pts         BIGINT,
  referral_pts         BIGINT,
  call_pts             BIGINT,
  first_import_xml_pts BIGINT,
  welcome_gift_pts     BIGINT,
  admin_manual_pts     BIGINT,
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
  v_admin_manual BIGINT;
  v_total BIGINT;
  v_rank BIGINT;
  v_monthly_ref BIGINT;
BEGIN
  SELECT
    COALESCE(SUM(points) FILTER (WHERE action_type = 'feedback_submitted'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'referral_signup'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'call_completed'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'first_import_xml'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'welcome_gift'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'admin_manual'), 0)
  INTO v_feedback, v_referral, v_call, v_first_import_xml, v_welcome_gift, v_admin_manual
  FROM public.user_contributions
  WHERE user_id = v_uid;

  v_total := v_feedback + v_referral + v_call + v_first_import_xml + v_welcome_gift + v_admin_manual;

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

  RETURN QUERY SELECT v_feedback, v_referral, v_call, v_first_import_xml, v_welcome_gift, v_admin_manual, v_total, v_rank, v_monthly_ref;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_contributions() TO authenticated;