-- ============================================================
-- Newsletter Subscribers — Email Capture & Lead Magnet (Epic 71)
-- Tabella per lead capture pre-signup con double opt-in GDPR
-- ============================================================

-- 1) CREATE TABLE
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  source              TEXT NOT NULL CHECK (source IN ('landing', 'blog', 'pro-waitlist', 'footer', 'other')),
  source_detail       TEXT,
  lead_magnet         TEXT,
  consent_text        TEXT NOT NULL,
  consent_given_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  double_opt_in_token TEXT,
  confirmed_at        TIMESTAMPTZ,
  unsubscribed_at     TIMESTAMPTZ,
  tags                TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Indice unique parziale: permette re-iscrizione dopo unsubscribe
CREATE UNIQUE INDEX idx_newsletter_subscribers_email_active
  ON public.newsletter_subscribers (email)
  WHERE unsubscribed_at IS NULL;

-- 3) Indice su double_opt_in_token per confirm/unsubscribe RPC
CREATE INDEX idx_newsletter_subscribers_token
  ON public.newsletter_subscribers (double_opt_in_token)
  WHERE double_opt_in_token IS NOT NULL;

-- 4) RLS: abilitato senza policy → solo service_role bypassa
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- RPC: subscribe_to_newsletter
-- Pubblica (anon + authenticated), SECURITY DEFINER
-- ============================================================
CREATE OR REPLACE FUNCTION public.subscribe_to_newsletter(
  p_email TEXT,
  p_source TEXT,
  p_source_detail TEXT DEFAULT NULL,
  p_lead_magnet TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  v_token := gen_random_uuid()::text;
  INSERT INTO newsletter_subscribers (
    email, source, source_detail, lead_magnet,
    consent_text, consent_given_at, double_opt_in_token
  )
  VALUES (
    lower(trim(p_email)), p_source, p_source_detail, p_lead_magnet,
    'Acconsento a ricevere email da Forfettino. Posso disiscrivermi in qualsiasi momento.',
    now(), v_token
  );
  RETURN json_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false);
  WHEN OTHERS THEN
    RETURN json_build_object('success', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.subscribe_to_newsletter(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.subscribe_to_newsletter(TEXT, TEXT, TEXT, TEXT) TO authenticated;


-- ============================================================
-- RPC: confirm_newsletter_subscription
-- Conferma double opt-in con token one-time, scadenza 7gg
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_newsletter_subscription(
  p_token TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  UPDATE newsletter_subscribers
  SET confirmed_at = now(),
      double_opt_in_token = NULL
  WHERE double_opt_in_token = p_token
    AND confirmed_at IS NULL
    AND created_at > now() - INTERVAL '7 days'
  RETURNING email INTO v_email;

  IF v_email IS NOT NULL THEN
    RETURN json_build_object('success', true, 'email', v_email);
  ELSE
    RETURN json_build_object('success', false, 'email', null);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_newsletter_subscription(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.confirm_newsletter_subscription(TEXT) TO authenticated;


-- ============================================================
-- RPC: unsubscribe_newsletter
-- Accetta email o token, imposta unsubscribed_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.unsubscribe_newsletter(
  p_token_or_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_found BOOLEAN := false;
BEGIN
  -- Prova prima per email
  UPDATE newsletter_subscribers
  SET unsubscribed_at = now()
  WHERE email = lower(trim(p_token_or_email))
    AND unsubscribed_at IS NULL;

  IF FOUND THEN
    v_found := true;
  ELSE
    -- Prova per token (double_opt_in_token)
    UPDATE newsletter_subscribers
    SET unsubscribed_at = now()
    WHERE double_opt_in_token = p_token_or_email
      AND unsubscribed_at IS NULL;

    IF FOUND THEN
      v_found := true;
    END IF;
  END IF;

  RETURN json_build_object('success', v_found);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unsubscribe_newsletter(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.unsubscribe_newsletter(TEXT) TO authenticated;
