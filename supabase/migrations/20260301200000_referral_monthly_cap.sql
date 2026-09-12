-- Epic 26-2: Referral Monthly Cap Anti-Gaming
-- Adds monthly_referral_count to get_my_contributions RPC
-- Updates trigger to skip point award when cap (10/month) is exceeded

-- MONTHLY_REFERRAL_CAP = 10 (hardcoded, changeable via future migration)

----------------------------------------------------------------------
-- 1. Drop + recreate get_my_contributions (return type changed)
----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_my_contributions();

CREATE OR REPLACE FUNCTION public.get_my_contributions()
RETURNS TABLE (
  feedback_pts           BIGINT,
  referral_pts           BIGINT,
  call_pts               BIGINT,
  first_import_xml_pts   BIGINT,
  welcome_gift_pts       BIGINT,
  admin_manual_pts       BIGINT,
  total_pts              BIGINT,
  my_rank                BIGINT,
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
  v_scadenza BIGINT;
  v_sessions BIGINT;
  v_total BIGINT;
  v_rank BIGINT;
  v_monthly_ref BIGINT;
BEGIN
  -- Single query with FILTER clauses
  SELECT
    COALESCE(SUM(points) FILTER (WHERE action_type = 'feedback_submitted'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'referral_signup'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'call_completed'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type IN ('first_receipt', 'import_xml', 'first_import_xml')), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'welcome_gift'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'admin_manual'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'scadenza_paid'), 0)
  INTO v_feedback, v_referral, v_call, v_first_import_xml, v_welcome_gift, v_admin_manual, v_scadenza
  FROM public.user_contributions
  WHERE user_id = v_uid;

  SELECT COUNT(DISTINCT session_date) INTO v_sessions
  FROM public.user_sessions WHERE user_id = v_uid;

  v_total := v_feedback + v_referral + v_call + v_first_import_xml + v_welcome_gift + v_admin_manual + v_scadenza + v_sessions;

  -- Compute rank among non-internal users using shared helper
  SELECT COUNT(*) + 1 INTO v_rank
  FROM public._contribution_totals() ct
  JOIN public.profiles p ON p.user_id = ct.uid AND p.is_internal IS NOT TRUE
  WHERE ct.total_pts > v_total;

  -- Count referrals (pending + confirmed) created in the current month (UTC)
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

----------------------------------------------------------------------
-- 2. Update trigger to enforce monthly cap on point award
----------------------------------------------------------------------
-- NOTE on cap semantics (intentionally different from Edge Function):
-- - Edge Function (gate): counts pending+confirmed in CURRENT month → prevents >10 invitations/month
-- - Trigger (point award): counts confirmed+points_awarded=true in referral's created_at month
--   → ensures max 10 point-awarding confirmations per month of invitation.
-- The Edge Function is the primary gate; the trigger is the safety net for direct DB inserts.
-- Race condition note: the Edge Function check+insert is not atomic, so under extreme
-- concurrency the displayed monthly_referral_count could momentarily exceed 10, but
-- the trigger correctly limits actual point awards to 10.
CREATE OR REPLACE FUNCTION public.process_referral_on_onboarding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral RECORD;
  v_monthly_count BIGINT;
  v_cap CONSTANT INT := 10; -- MONTHLY_REFERRAL_CAP
BEGIN
  -- Only fire when onboarding_completed changes to true
  IF NEW.onboarding_completed = true AND (OLD.onboarding_completed IS NULL OR OLD.onboarding_completed = false) THEN
    -- Find pending referral for this invitee
    SELECT * INTO v_referral
    FROM public.referrals
    WHERE invitee_user_id = NEW.user_id AND status = 'pending' AND points_awarded = false
    LIMIT 1;

    IF v_referral IS NOT NULL THEN
      -- Check monthly cap: how many referrals already awarded points in the same month?
      SELECT COUNT(*) INTO v_monthly_count
      FROM public.referrals
      WHERE referrer_user_id = v_referral.referrer_user_id
        AND status = 'confirmed'
        AND points_awarded = true
        AND created_at >= date_trunc('month', v_referral.created_at)
        AND created_at < date_trunc('month', v_referral.created_at) + INTERVAL '1 month';

      IF v_monthly_count >= v_cap THEN
        -- Cap reached: confirm referral but do NOT award points
        UPDATE public.referrals
        SET status = 'confirmed', confirmed_at = now()
        WHERE id = v_referral.id;
        -- points_awarded stays false — referral tracked for audit but no points
      ELSE
        -- Under cap: confirm referral AND award points
        UPDATE public.referrals
        SET status = 'confirmed', confirmed_at = now(), points_awarded = true
        WHERE id = v_referral.id;

        -- Award 100 points to referrer
        INSERT INTO public.user_contributions (user_id, action_type, points, metadata)
        VALUES (v_referral.referrer_user_id, 'referral_signup', 100,
                jsonb_build_object('invitee_user_id', NEW.user_id::text));
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
