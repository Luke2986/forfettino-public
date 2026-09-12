-- Story 72-3: Waitlist Referral Loop — waitlist_leads referral + RPCs aggiornate + get_my_referral_info

----------------------------------------------------------------------
-- 1. Aggiungere referred_by_token a waitlist_leads
----------------------------------------------------------------------
ALTER TABLE waitlist_leads ADD COLUMN referred_by_token TEXT;

----------------------------------------------------------------------
-- 2. CREATE OR REPLACE join_waitlist_lead con p_referred_by_token
----------------------------------------------------------------------
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
BEGIN
  -- Normalizza email
  v_email := lower(trim(p_email));

  -- Validazione base
  IF v_email IS NULL OR v_email = '' OR position('@' IN v_email) = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_email');
  END IF;

  -- Rate limit: max 3 insert per email/ora
  IF (
    SELECT count(*) FROM waitlist_leads
    WHERE lower(email) = v_email
      AND created_at > now() - interval '1 hour'
  ) >= 3 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'rate_limited');
  END IF;

  -- Rate limit globale: max 20 insert/minuto (anti-spam bulk)
  IF (
    SELECT count(*) FROM waitlist_leads
    WHERE created_at > now() - interval '1 minute'
  ) >= 20 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'rate_limited');
  END IF;

  -- Gia' in pro_waitlist (utente registrato)?
  IF EXISTS (
    SELECT 1 FROM pro_waitlist
    WHERE lower(email) = v_email AND revoked_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_in_waitlist');
  END IF;

  -- Gia' in waitlist_leads?
  IF EXISTS (
    SELECT 1 FROM waitlist_leads WHERE lower(email) = v_email
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_registered');
  END IF;

  -- Anti-abuse: referrer email != new lead email
  IF p_referred_by_token IS NOT NULL THEN
    SELECT email INTO v_referrer_email
    FROM pro_waitlist
    WHERE referral_token = p_referred_by_token AND revoked_at IS NULL;

    IF v_referrer_email IS NOT NULL AND lower(v_referrer_email) = v_email THEN
      -- Auto-referral email-based: ignora il token silenziosamente
      p_referred_by_token := NULL;
    END IF;
  END IF;

  -- Insert
  INSERT INTO waitlist_leads (email, source, source_detail, consent_text, referred_by_token)
  VALUES (v_email, p_source, p_source_detail, p_consent_text, p_referred_by_token);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Rimuovi vecchio grant (4 parametri) e ricrea per 5 parametri
DROP FUNCTION IF EXISTS public.join_waitlist_lead(TEXT, TEXT, TEXT, TEXT);
GRANT EXECUTE ON FUNCTION public.join_waitlist_lead(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

----------------------------------------------------------------------
-- 3. CREATE OR REPLACE merge_waitlist_lead_if_exists — copia referred_by_token
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.merge_waitlist_lead_if_exists(
  p_user_id UUID,
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
BEGIN
  -- Validazione: solo l'utente stesso puo' fare merge
  IF p_user_id != auth.uid() THEN
    RETURN jsonb_build_object('merged', false);
  END IF;

  -- Cerca lead con email corrispondente
  SELECT * INTO v_lead
  FROM waitlist_leads
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  -- Nessun lead trovato
  IF v_lead IS NULL THEN
    RETURN jsonb_build_object('merged', false);
  END IF;

  -- Utente gia' in pro_waitlist? Non duplicare
  IF EXISTS (
    SELECT 1 FROM pro_waitlist WHERE user_id = p_user_id
  ) THEN
    -- Elimina il lead orfano comunque
    DELETE FROM waitlist_leads WHERE id = v_lead.id;
    RETURN jsonb_build_object('merged', false);
  END IF;

  -- Inserisci in pro_waitlist con dati dal lead (incluso referred_by_token)
  INSERT INTO pro_waitlist (user_id, email, consent_text, referred_by_token)
  VALUES (p_user_id, v_lead.email, v_lead.consent_text, v_lead.referred_by_token);

  -- Elimina il lead
  DELETE FROM waitlist_leads WHERE id = v_lead.id;

  RETURN jsonb_build_object('merged', true);
END;
$$;

----------------------------------------------------------------------
-- 4. RPC get_my_referral_info — info referral per utente autenticato
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_referral_info()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_next_boost_at INT;
  v_next_boost_label TEXT;
BEGIN
  SELECT referral_token, invites_count, queue_position_boost
  INTO v_row
  FROM pro_waitlist
  WHERE user_id = auth.uid() AND revoked_at IS NULL;

  IF v_row IS NULL THEN
    RETURN jsonb_build_object('referral_token', null);
  END IF;

  -- Calcolo next boost
  IF v_row.invites_count < 3 THEN
    v_next_boost_at := 3;
    v_next_boost_label := 'Priority +1 slot';
  ELSIF v_row.invites_count < 5 THEN
    v_next_boost_at := 5;
    v_next_boost_label := 'Early access 48h';
  ELSIF v_row.invites_count < 10 THEN
    v_next_boost_at := 10;
    v_next_boost_label := 'Lifetime tier garantito';
  ELSE
    v_next_boost_at := NULL;
    v_next_boost_label := NULL;
  END IF;

  RETURN jsonb_build_object(
    'referral_token', v_row.referral_token,
    'invites_count', v_row.invites_count,
    'queue_position_boost', v_row.queue_position_boost,
    'next_boost_at', v_next_boost_at,
    'next_boost_label', v_next_boost_label
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_referral_info() TO authenticated;
