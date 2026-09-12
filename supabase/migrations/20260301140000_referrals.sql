-- Epic 26: Referrals table + trigger for automatic point award on onboarding
-- Uses existing user_code as referral code (no separate code needed)

CREATE TABLE IF NOT EXISTS public.referrals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referrer_code    TEXT NOT NULL,
  invitee_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invitee_email    TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  points_awarded   BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at     TIMESTAMPTZ,

  CONSTRAINT referrals_status_check CHECK (
    status IN ('pending', 'confirmed', 'expired')
  )
);

CREATE INDEX idx_referrals_referrer ON public.referrals (referrer_user_id);
CREATE INDEX idx_referrals_invitee ON public.referrals (invitee_user_id);
CREATE INDEX idx_referrals_code ON public.referrals (referrer_code);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Referrer can see their own referrals
CREATE POLICY "Users can read own referrals"
  ON public.referrals
  FOR SELECT
  USING (auth.uid() = referrer_user_id);

-- Admin can read all
CREATE POLICY "Admin can read all referrals"
  ON public.referrals
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

----------------------------------------------------------------------
-- RPC: process_referral_signup — called after signup with referral code
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_referral_signup(p_referrer_code TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_user_id UUID;
BEGIN
  -- Advisory lock per-invitee to prevent duplicate referral rows on concurrent calls
  PERFORM pg_advisory_xact_lock(hashtext('referral_' || auth.uid()::text));

  -- Find referrer by user_code
  SELECT user_id INTO v_referrer_user_id
  FROM public.profiles
  WHERE user_code = p_referrer_code;

  IF v_referrer_user_id IS NULL THEN
    RETURN; -- invalid code, silently ignore
  END IF;

  -- Don't allow self-referral
  IF v_referrer_user_id = auth.uid() THEN
    RETURN;
  END IF;

  -- Check for existing referral for this invitee
  IF EXISTS (
    SELECT 1 FROM public.referrals WHERE invitee_user_id = auth.uid()
  ) THEN
    RETURN; -- already referred
  END IF;

  INSERT INTO public.referrals (referrer_user_id, referrer_code, invitee_user_id, status)
  VALUES (v_referrer_user_id, p_referrer_code, auth.uid(), 'pending');
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_referral_signup(TEXT) TO authenticated;

----------------------------------------------------------------------
-- Trigger: auto-confirm referral when invitee completes onboarding
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_referral_on_onboarding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral RECORD;
BEGIN
  -- Only fire when onboarding_completed changes to true
  IF NEW.onboarding_completed = true AND (OLD.onboarding_completed IS NULL OR OLD.onboarding_completed = false) THEN
    -- Find pending referral for this invitee
    SELECT * INTO v_referral
    FROM public.referrals
    WHERE invitee_user_id = NEW.user_id AND status = 'pending' AND points_awarded = false
    LIMIT 1;

    IF v_referral IS NOT NULL THEN
      -- Confirm referral
      UPDATE public.referrals
      SET status = 'confirmed', confirmed_at = now(), points_awarded = true
      WHERE id = v_referral.id;

      -- Award 100 points to referrer
      INSERT INTO public.user_contributions (user_id, action_type, points, metadata)
      VALUES (v_referral.referrer_user_id, 'referral_signup', 100,
              jsonb_build_object('invitee_user_id', NEW.user_id::text));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- WHEN clause ensures trigger only fires when onboarding_completed actually changes,
-- avoiding overhead on every profile update (name change, settings, etc.)
CREATE TRIGGER trg_referral_on_onboarding
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (NEW.onboarding_completed IS DISTINCT FROM OLD.onboarding_completed)
  EXECUTE FUNCTION public.process_referral_on_onboarding();
