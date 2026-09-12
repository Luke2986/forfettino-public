-- Story 26-4: Referral trigger reads points from contribution_action_config
-- Replaces hardcoded 100 with dynamic lookup.
-- Cap logic (10/month) unchanged.

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
  v_points INTEGER;
BEGIN
  -- Only fire when onboarding_completed changes to true
  IF NEW.onboarding_completed = true AND (OLD.onboarding_completed IS NULL OR OLD.onboarding_completed = false) THEN
    -- Find pending referral for this invitee
    SELECT * INTO v_referral
    FROM public.referrals
    WHERE invitee_user_id = NEW.user_id AND status = 'pending' AND points_awarded = false
    LIMIT 1;

    IF v_referral IS NOT NULL THEN
      -- Check monthly cap for the referrer (based on referral created_at month)
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
      ELSE
        -- Read points from config (not hardcoded)
        SELECT points INTO v_points
        FROM public.contribution_action_config
        WHERE action_type = 'referral_signup' AND is_active = true;

        -- Under cap: confirm referral AND award points
        UPDATE public.referrals
        SET status = 'confirmed', confirmed_at = now(), points_awarded = true
        WHERE id = v_referral.id;

        IF v_points IS NOT NULL AND v_points > 0 THEN
          INSERT INTO public.user_contributions (user_id, action_type, points, metadata)
          VALUES (v_referral.referrer_user_id, 'referral_signup', v_points,
                  jsonb_build_object('invitee_user_id', NEW.user_id::text));
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
