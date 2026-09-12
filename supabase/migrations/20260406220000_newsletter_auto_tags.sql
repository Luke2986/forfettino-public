-- ============================================================
-- Newsletter Auto-Tags & Admin Tag Management (Story 71-5)
-- ============================================================
-- Tag convention: lowercase, kebab-case, italiano
-- Source tags: landing, blog, blog-{slug}, footer, pro-waitlist
-- Lead magnet tags: lead-magnet, guida-protezione, scadenziario-2026
-- Interest tags: interesse-inps
-- Manual tags: formato libero admin (suggerimento: forfettario-nuovo, separata, pro-interest)
-- ============================================================


-- 1) DROP vecchia subscribe_to_newsletter a 4 parametri (signature change)
DROP FUNCTION IF EXISTS public.subscribe_to_newsletter(TEXT, TEXT, TEXT, TEXT);


-- 2) RECREATE subscribe_to_newsletter con 5 parametri (+ p_initial_tags)
CREATE OR REPLACE FUNCTION public.subscribe_to_newsletter(
  p_email TEXT,
  p_source TEXT,
  p_source_detail TEXT DEFAULT NULL,
  p_lead_magnet TEXT DEFAULT NULL,
  p_initial_tags TEXT[] DEFAULT '{}'::text[]
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
    consent_text, consent_given_at, double_opt_in_token, tags
  )
  VALUES (
    lower(trim(p_email)), p_source, p_source_detail, p_lead_magnet,
    'Acconsento a ricevere email da Forfettino. Posso disiscrivermi in qualsiasi momento.',
    now(), v_token,
    p_initial_tags
  );
  RETURN json_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false);
  WHEN OTHERS THEN
    RETURN json_build_object('success', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.subscribe_to_newsletter(TEXT, TEXT, TEXT, TEXT, TEXT[]) TO anon;
GRANT EXECUTE ON FUNCTION public.subscribe_to_newsletter(TEXT, TEXT, TEXT, TEXT, TEXT[]) TO authenticated;


-- 3) REPLACE confirm_newsletter_subscription con auto-tagging
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

-- GRANT invariato (signature (TEXT) non cambia)
GRANT EXECUTE ON FUNCTION public.confirm_newsletter_subscription(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.confirm_newsletter_subscription(TEXT) TO authenticated;


-- 4) NUOVA RPC: add_tag_to_subscriber (admin-only)
CREATE OR REPLACE FUNCTION public.add_tag_to_subscriber(
  p_email TEXT,
  p_tag TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Empty tag guard
  IF trim(p_tag) = '' THEN
    RETURN json_build_object('success', false, 'error', 'empty_tag');
  END IF;

  -- Admin check
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true) THEN
    RETURN json_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Add tag if not already present (dedup guard)
  UPDATE newsletter_subscribers
  SET tags = array_append(tags, lower(trim(p_tag)))
  WHERE email = lower(trim(p_email))
    AND NOT (tags @> ARRAY[lower(trim(p_tag))]);

  RETURN json_build_object('success', FOUND);
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_tag_to_subscriber(TEXT, TEXT) TO authenticated;
