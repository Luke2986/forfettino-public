-- Lead magnet "simulatore_acconti_2026": auto-tag in confirm_newsletter_subscription.
-- Il valore lead_magnet e' TEXT libero (nessun constraint): il flusso funziona gia' senza
-- questa migration. Serve solo per la segmentazione admin (tag 'simulatore-acconti-2026').
-- Aggiunge anche il tag di source 'calcolatore' (finora non gestito) dove vive il magnet.

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
  v_source TEXT;
  v_source_detail TEXT;
  v_lead_magnet TEXT;
  v_existing_tags TEXT[];
  v_auto_tags TEXT[];
BEGIN
  -- Step 1: SELECT con FOR UPDATE lock per leggere source/lead_magnet/tags
  SELECT email, source, source_detail, lead_magnet, tags
  INTO v_email, v_source, v_source_detail, v_lead_magnet, v_existing_tags
  FROM newsletter_subscribers
  WHERE double_opt_in_token = p_token
    AND confirmed_at IS NULL
    AND created_at > now() - INTERVAL '7 days'
  FOR UPDATE;

  IF v_email IS NULL THEN
    RETURN json_build_object('success', false, 'email', null);
  END IF;

  -- Step 2: Calcola auto-tags
  v_auto_tags := '{}'::text[];

  -- Source-based tags
  IF v_source = 'blog' THEN
    v_auto_tags := v_auto_tags || ARRAY['blog'];
  END IF;
  IF v_source = 'blog' AND v_source_detail IS NOT NULL THEN
    v_auto_tags := v_auto_tags || ARRAY['blog-' || regexp_replace(lower(v_source_detail), '[^a-z0-9-]', '-', 'g')];
  END IF;
  IF v_source = 'landing' THEN
    v_auto_tags := v_auto_tags || ARRAY['landing'];
  END IF;
  IF v_source = 'footer' THEN
    v_auto_tags := v_auto_tags || ARRAY['footer'];
  END IF;
  IF v_source = 'calcolatore' THEN
    v_auto_tags := v_auto_tags || ARRAY['calcolatore'];
  END IF;
  IF v_source = 'pro-waitlist' THEN
    v_auto_tags := v_auto_tags || ARRAY['pro-waitlist'];
  END IF;

  -- Lead magnet tags
  IF v_lead_magnet = 'scadenziario_2026' THEN
    v_auto_tags := v_auto_tags || ARRAY['scadenziario-2026', 'lead-magnet'];
  END IF;
  IF v_lead_magnet = 'guida_protezione' THEN
    v_auto_tags := v_auto_tags || ARRAY['guida-protezione', 'lead-magnet'];
  END IF;
  IF v_lead_magnet = 'simulatore_acconti_2026' THEN
    v_auto_tags := v_auto_tags || ARRAY['simulatore-acconti-2026', 'lead-magnet'];
  END IF;

  -- INPS interest detection
  IF v_source_detail IS NOT NULL AND (v_source_detail ILIKE '%inps%' OR v_source_detail ILIKE '%contributi%') THEN
    v_auto_tags := v_auto_tags || ARRAY['interesse-inps'];
  END IF;

  -- Step 3: UPDATE con merge + dedup tags
  UPDATE newsletter_subscribers
  SET confirmed_at = now(),
      double_opt_in_token = NULL,
      tags = (SELECT ARRAY(SELECT DISTINCT unnest(v_existing_tags || v_auto_tags)))
  WHERE double_opt_in_token = p_token
    AND confirmed_at IS NULL;

  RETURN json_build_object('success', true, 'email', v_email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_newsletter_subscription(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.confirm_newsletter_subscription(TEXT) TO authenticated;
