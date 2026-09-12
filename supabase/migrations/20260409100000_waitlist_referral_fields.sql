-- Story 72-3: Waitlist Referral Loop — Campi referral su pro_waitlist
-- Aggiunge referral_token, referred_by_token, queue_position_boost, invites_count
-- + trigger BEFORE INSERT per generazione token
-- + trigger AFTER INSERT per boost referrer

----------------------------------------------------------------------
-- 1. Nuove colonne
----------------------------------------------------------------------
ALTER TABLE pro_waitlist ADD COLUMN referral_token TEXT UNIQUE;
ALTER TABLE pro_waitlist ADD COLUMN referred_by_token TEXT;
ALTER TABLE pro_waitlist ADD COLUMN queue_position_boost INT NOT NULL DEFAULT 0;
ALTER TABLE pro_waitlist ADD COLUMN invites_count INT NOT NULL DEFAULT 0;

----------------------------------------------------------------------
-- 2. Backfill token per record esistenti
----------------------------------------------------------------------
UPDATE pro_waitlist
SET referral_token = encode(gen_random_bytes(8), 'hex')
WHERE referral_token IS NULL;

----------------------------------------------------------------------
-- 3. Rendere NOT NULL dopo backfill
----------------------------------------------------------------------
ALTER TABLE pro_waitlist ALTER COLUMN referral_token SET NOT NULL;

----------------------------------------------------------------------
-- 4. Trigger BEFORE INSERT — genera referral_token se NULL
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_pro_waitlist_generate_token()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_token TEXT;
  v_attempt INT := 0;
BEGIN
  IF NEW.referral_token IS NULL THEN
    LOOP
      v_token := encode(gen_random_bytes(8), 'hex');
      -- Verifica unicita' (il UNIQUE constraint cattura comunque, ma evitiamo errore)
      IF NOT EXISTS (SELECT 1 FROM pro_waitlist WHERE referral_token = v_token) THEN
        NEW.referral_token := v_token;
        EXIT;
      END IF;
      v_attempt := v_attempt + 1;
      IF v_attempt >= 3 THEN
        RAISE EXCEPTION 'Failed to generate unique referral_token after 3 attempts';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pro_waitlist_generate_token
  BEFORE INSERT ON pro_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_pro_waitlist_generate_token();

----------------------------------------------------------------------
-- 5. Trigger AFTER INSERT — incrementa invites_count e boost del referrer
----------------------------------------------------------------------
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

  -- Se referrer non trovato (token invalido o revocato): no-op
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pro_waitlist_referral_boost
  AFTER INSERT ON pro_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_pro_waitlist_referral_boost();
