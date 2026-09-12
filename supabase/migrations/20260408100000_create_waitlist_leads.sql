-- Waitlist Leads — raccolta email visitatori anonimi per lancio PRO
-- Tabella separata da pro_waitlist (che richiede user_id NOT NULL).
-- Al futuro login, il lead viene convertito in pro_waitlist via RPC merge_waitlist_lead_if_exists.

CREATE TABLE waitlist_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'pro-waitlist',
  source_detail TEXT,
  consent_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indice UNIQUE case-insensitive per evitare duplicati
CREATE UNIQUE INDEX idx_waitlist_leads_email_lower ON waitlist_leads (lower(email));

-- RLS
ALTER TABLE waitlist_leads ENABLE ROW LEVEL SECURITY;

-- Anon e authenticated possono inserire (via RPC SECURITY DEFINER, ma policy necessaria per completezza)
CREATE POLICY "Insert via RPC only"
  ON waitlist_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- SELECT solo service_role e admin
CREATE POLICY "Admins can view all leads"
  ON waitlist_leads FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- DELETE bloccato via RLS — avviene solo dentro RPC SECURITY DEFINER (che bypassa RLS)
-- Nessuna policy DELETE diretta per utenti normali

----------------------------------------------------------------------
-- RPC: join_waitlist_lead — iscrizione anonima alla waitlist
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_waitlist_lead(
  p_email TEXT,
  p_source TEXT,
  p_consent_text TEXT,
  p_source_detail TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
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

  -- Insert
  INSERT INTO waitlist_leads (email, source, source_detail, consent_text)
  VALUES (v_email, p_source, p_source_detail, p_consent_text);

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_waitlist_lead(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

----------------------------------------------------------------------
-- RPC: merge_waitlist_lead_if_exists — converte lead anonimo in pro_waitlist
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
  -- Validazione: solo l'utente stesso può fare merge
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

  -- Inserisci in pro_waitlist con dati dal lead
  INSERT INTO pro_waitlist (user_id, email, consent_text)
  VALUES (p_user_id, v_lead.email, v_lead.consent_text);

  -- Elimina il lead
  DELETE FROM waitlist_leads WHERE id = v_lead.id;

  RETURN jsonb_build_object('merged', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_waitlist_lead_if_exists(UUID, TEXT) TO authenticated;
