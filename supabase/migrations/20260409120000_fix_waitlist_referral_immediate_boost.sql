-- Fix: referral boost immediato per lead anonimi + anti-double-count al merge
--
-- Problema: quando un visitatore anonimo si iscrive via link referral,
-- il referred_by_token viene salvato in waitlist_leads ma il referrer
-- NON riceve l'incremento invites_count (il trigger è solo su pro_waitlist).
-- Il boost arriva solo se/quando il lead fa login e il merge lo sposta
-- in pro_waitlist — spesso mai.
--
-- Fix:
-- 1. join_waitlist_lead incrementa subito invites_count del referrer
-- 2. trg_fn_pro_waitlist_referral_boost salta l'incremento se il boost
--    è già stato conteggiato al momento del lead (anti-double-count)

----------------------------------------------------------------------
-- 1. Aggiornare join_waitlist_lead — incremento referrer immediato
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
  v_new_count INT;
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

  -- Insert lead
  INSERT INTO waitlist_leads (email, source, source_detail, consent_text, referred_by_token)
  VALUES (v_email, p_source, p_source_detail, p_consent_text, p_referred_by_token);

  -- *** NEW: Incrementa subito invites_count e boost del referrer ***
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
    -- Se referrer non trovato (token invalido/revocato): no-op, INSERT prosegue
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant rimane invariato (5 parametri, già concesso dalla migration precedente)

----------------------------------------------------------------------
-- 2. Aggiornare trigger anti-double-count
----------------------------------------------------------------------
-- Quando merge_waitlist_lead_if_exists inserisce in pro_waitlist con
-- referred_by_token, il trigger AFTER INSERT scatterebbe di nuovo.
-- Per evitare doppio conteggio, controlliamo se esiste un waitlist_leads
-- con la stessa email e lo stesso referred_by_token (significa: il boost
-- è già stato dato al momento dell'iscrizione lead).
-- Nota: al momento del trigger, la riga waitlist_leads esiste ancora
-- (viene cancellata DOPO l'INSERT nella funzione merge).

CREATE OR REPLACE FUNCTION trg_fn_pro_waitlist_referral_boost()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_count INT;
BEGIN
  -- Solo se ha un referrer
  IF NEW.referred_by_token IS NULL THEN
    RETURN NEW;
  END IF;

  -- Anti-abuse: no auto-referral
  IF NEW.referred_by_token = NEW.referral_token THEN
    RETURN NEW;
  END IF;

  -- Anti-double-count: se questo INSERT viene da un merge di un lead
  -- che ha già ricevuto il boost al momento dell'iscrizione anonima,
  -- la riga waitlist_leads esiste ancora (viene eliminata dopo l'INSERT).
  IF EXISTS (
    SELECT 1 FROM waitlist_leads
    WHERE lower(email) = lower(NEW.email)
      AND referred_by_token = NEW.referred_by_token
  ) THEN
    -- Boost già conteggiato durante join_waitlist_lead, skip
    RETURN NEW;
  END IF;

  -- Incrementa invites_count e ricalcola boost
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
