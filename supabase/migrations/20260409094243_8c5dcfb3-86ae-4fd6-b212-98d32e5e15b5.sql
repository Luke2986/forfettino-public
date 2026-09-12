-- Fix: referral boost immediato per lead anonimi + anti-double-count al merge

CREATE OR REPLACE FUNCTION public.join_waitlist_lead(
  p_email TEXT,
  p_source TEXT,
  p_consent_text TEXT,
  p_source_detail TEXT DEFAULT NULL,
  p_referred_by_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_referrer_email TEXT;
  v_new_count INT;
BEGIN
  v_email := lower(trim(p_email));

  IF v_email IS NULL OR v_email = '' OR position('@' IN v_email) = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_email');
  END IF;

  IF (
    SELECT count(*) FROM waitlist_leads
    WHERE lower(email) = v_email
      AND created_at > now() - interval '1 hour'
  ) >= 3 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'rate_limited');
  END IF;

  IF (
    SELECT count(*) FROM waitlist_leads
    WHERE created_at > now() - interval '1 minute'
  ) >= 20 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'rate_limited');
  END IF;

  IF EXISTS (
    SELECT 1 FROM pro_waitlist
    WHERE lower(email) = v_email AND revoked_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_in_waitlist');
  END IF;

  IF EXISTS (
    SELECT 1 FROM waitlist_leads WHERE lower(email) = v_email
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_registered');
  END IF;

  IF p_referred_by_token IS NOT NULL THEN
    SELECT email INTO v_referrer_email
    FROM pro_waitlist
    WHERE referral_token = p_referred_by_token AND revoked_at IS NULL;

    IF v_referrer_email IS NOT NULL AND lower(v_referrer_email) = v_email THEN
      p_referred_by_token := NULL;
    END IF;
  END IF;

  INSERT INTO waitlist_leads (email, source, source_detail, consent_text, referred_by_token)
  VALUES (v_email, p_source, p_source_detail, p_consent_text, p_referred_by_token);

  IF p_referred_by_token IS NOT NULL THEN
    UPDATE pro_waitlist
    SET
      invites_count = invites_count + 1,
      queue_position_boost = CASE
        WHEN invites_count + 1 >= 10 THEN 3
        WHEN invites_count + 1 >= 5  THEN 2
        WHEN invites_count + 1 >= 3  THEN 1
        ELSE 0
      END
    WHERE referral_token = p_referred_by_token
      AND revoked_at IS NULL
    RETURNING invites_count INTO v_new_count;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION trg_fn_pro_waitlist_referral_boost()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_count INT;
BEGIN
  IF NEW.referred_by_token IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.referred_by_token = NEW.referral_token THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM waitlist_leads
    WHERE lower(email) = lower(NEW.email)
      AND referred_by_token = NEW.referred_by_token
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE pro_waitlist
  SET
    invites_count = invites_count + 1,
    queue_position_boost = CASE
      WHEN invites_count + 1 >= 10 THEN 3
      WHEN invites_count + 1 >= 5  THEN 2
      WHEN invites_count + 1 >= 3  THEN 1
      ELSE 0
    END
  WHERE referral_token = NEW.referred_by_token
    AND revoked_at IS NULL
  RETURNING invites_count INTO v_new_count;

  RETURN NEW;
END;
$$;