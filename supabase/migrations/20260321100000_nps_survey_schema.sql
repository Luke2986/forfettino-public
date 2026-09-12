-- Epic 50, Story 50-1: NPS Survey — Schema, Budget 60gg, Persistenza
-- Depends on: survey_responses, profiles, user_contributions, contribution_action_config

----------------------------------------------------------------------
-- 1. CREATE TABLE nps_campaigns
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nps_campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active        BOOLEAN NOT NULL DEFAULT false,
  enabled_triggers JSONB NOT NULL DEFAULT '[]'::jsonb,
  repeat_interval  TEXT NOT NULL DEFAULT 'never'
    CHECK (repeat_interval IN ('never', '3m', '6m', '12m')),
  start_date       DATE,
  end_date         DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nps_campaigns ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read campaigns (to check if active)
CREATE POLICY "Authenticated can read nps_campaigns"
  ON public.nps_campaigns
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Admin can manage campaigns
CREATE POLICY "Admin can manage nps_campaigns"
  ON public.nps_campaigns
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_nps_campaigns_is_active
  ON public.nps_campaigns (is_active) WHERE is_active = true;

----------------------------------------------------------------------
-- 2. ALTER TABLE survey_responses — add NPS-specific columns
----------------------------------------------------------------------
ALTER TABLE public.survey_responses
  ADD COLUMN IF NOT EXISTS score INTEGER CHECK (score IS NULL OR (score >= 0 AND score <= 10)),
  ADD COLUMN IF NOT EXISTS comment TEXT,
  ADD COLUMN IF NOT EXISTS trigger_source TEXT,
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.nps_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_survey_responses_campaign_id
  ON public.survey_responses (campaign_id) WHERE campaign_id IS NOT NULL;

----------------------------------------------------------------------
-- 3. ALTER TABLE profiles — add last_survey_completed_at
----------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_survey_completed_at TIMESTAMPTZ;

----------------------------------------------------------------------
-- 4. RPC: record_nps_response — atomic persist with 60-day budget
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_nps_response(
  p_score INTEGER,
  p_comment TEXT DEFAULT NULL,
  p_trigger_source TEXT DEFAULT 'unknown',
  p_campaign_id UUID DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user_code TEXT;
  v_last_survey TIMESTAMPTZ;
BEGIN
  -- Advisory lock per-user to prevent race condition
  PERFORM pg_advisory_xact_lock(hashtext('nps_response_' || v_uid::text));

  -- Validate score range
  IF p_score IS NULL OR p_score < 0 OR p_score > 10 THEN
    RAISE EXCEPTION 'invalid_score';
  END IF;

  -- Fetch budget + codice_utente in one query
  SELECT last_survey_completed_at, user_code
  INTO v_last_survey, v_user_code
  FROM public.profiles
  WHERE user_id = v_uid;

  -- Check 60-day budget (server-side enforcement)
  IF v_last_survey IS NOT NULL AND v_last_survey > now() - INTERVAL '60 days' THEN
    RAISE EXCEPTION 'survey_cooldown_active';
  END IF;

  -- Insert NPS response into survey_responses
  INSERT INTO public.survey_responses (
    user_id, survey_key, selected_reason, free_text,
    score, comment, trigger_source, campaign_id
  ) VALUES (
    v_uid,
    'nps_v1',
    jsonb_build_object(
      'score', p_score,
      'comment', coalesce(p_comment, ''),
      'trigger_source', p_trigger_source,
      'codice_utente', coalesce(v_user_code, '')
    )::text,
    p_comment,
    p_score,
    p_comment,
    p_trigger_source,
    p_campaign_id
  );

  -- Atomically update last_survey_completed_at
  UPDATE public.profiles
  SET last_survey_completed_at = now()
  WHERE user_id = v_uid;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_nps_response(INTEGER, TEXT, TEXT, UUID) TO authenticated;

----------------------------------------------------------------------
-- 5. Extend CHECK constraint for 'nps_survey_completed'
----------------------------------------------------------------------
ALTER TABLE public.user_contributions
  DROP CONSTRAINT IF EXISTS user_contributions_action_type_check;

ALTER TABLE public.user_contributions
  ADD CONSTRAINT user_contributions_action_type_check CHECK (
    action_type IN (
      'feedback_submitted',
      'referral_signup',
      'call_completed',
      'first_import_xml',
      'welcome_gift',
      'admin_manual',
      'pricing_survey_completed',
      'calendar_survey_completed',
      'nps_survey_completed'
    )
  );

----------------------------------------------------------------------
-- 6. Seed contribution_action_config for NPS
----------------------------------------------------------------------
INSERT INTO public.contribution_action_config
  (action_type, points, label, frequency_label, color_bg, color_text, display_order)
VALUES
  ('nps_survey_completed', 5, 'Survey NPS', 'una tantum', 'bg-emerald-500', 'text-emerald-700', 7)
ON CONFLICT (action_type) DO NOTHING;

----------------------------------------------------------------------
-- 7. RPC: record_nps_survey_contribution (one-time, from config)
----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_nps_survey_contribution()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_points INTEGER;
BEGIN
  -- Advisory lock per-user to prevent double-award
  PERFORM pg_advisory_xact_lock(hashtext('nps_survey_' || v_uid::text));

  -- Already awarded?
  IF EXISTS (
    SELECT 1 FROM public.user_contributions
    WHERE user_id = v_uid AND action_type = 'nps_survey_completed'
  ) THEN
    RETURN false;
  END IF;

  -- Verify user actually submitted the NPS survey
  IF NOT EXISTS (
    SELECT 1 FROM public.survey_responses
    WHERE user_id = v_uid AND survey_key = 'nps_v1'
  ) THEN
    RETURN false;
  END IF;

  -- Read points from config
  SELECT points INTO v_points
  FROM public.contribution_action_config
  WHERE action_type = 'nps_survey_completed' AND is_active = true;

  IF v_points IS NULL THEN RETURN false; END IF;

  INSERT INTO public.user_contributions (user_id, action_type, points)
  VALUES (v_uid, 'nps_survey_completed', v_points);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_nps_survey_contribution() TO authenticated;

----------------------------------------------------------------------
-- 8. Update get_my_contributions — add nps_survey_pts (+ pricing/calendar survey pts)
----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_my_contributions();

CREATE OR REPLACE FUNCTION public.get_my_contributions()
RETURNS TABLE (
  feedback_pts           BIGINT,
  referral_pts           BIGINT,
  call_pts               BIGINT,
  first_import_xml_pts   BIGINT,
  welcome_gift_pts       BIGINT,
  admin_manual_pts       BIGINT,
  nps_survey_pts         BIGINT,
  total_pts              BIGINT,
  my_rank                BIGINT,
  monthly_referral_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_feedback BIGINT;
  v_referral BIGINT;
  v_call BIGINT;
  v_first_import_xml BIGINT;
  v_welcome_gift BIGINT;
  v_admin_manual BIGINT;
  v_nps_survey BIGINT;
  v_total BIGINT;
  v_rank BIGINT;
  v_monthly_ref BIGINT;
BEGIN
  SELECT
    COALESCE(SUM(points) FILTER (WHERE action_type = 'feedback_submitted'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'referral_signup'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'call_completed'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'first_import_xml'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'welcome_gift'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type = 'admin_manual'), 0),
    COALESCE(SUM(points) FILTER (WHERE action_type IN ('nps_survey_completed', 'pricing_survey_completed', 'calendar_survey_completed')), 0)
  INTO v_feedback, v_referral, v_call, v_first_import_xml, v_welcome_gift, v_admin_manual, v_nps_survey
  FROM public.user_contributions
  WHERE user_id = v_uid;

  v_total := v_feedback + v_referral + v_call + v_first_import_xml + v_welcome_gift + v_admin_manual + v_nps_survey;

  SELECT COUNT(*) + 1 INTO v_rank
  FROM public._contribution_totals() ct
  JOIN public.profiles p ON p.user_id = ct.uid AND p.is_internal IS NOT TRUE
  WHERE ct.total_pts > v_total;

  SELECT COUNT(*) INTO v_monthly_ref
  FROM public.referrals
  WHERE referrer_user_id = v_uid
    AND status IN ('pending', 'confirmed')
    AND created_at >= date_trunc('month', now())
    AND created_at < date_trunc('month', now()) + INTERVAL '1 month';

  RETURN QUERY SELECT v_feedback, v_referral, v_call, v_first_import_xml, v_welcome_gift, v_admin_manual, v_nps_survey, v_total, v_rank, v_monthly_ref;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_contributions() TO authenticated;

----------------------------------------------------------------------
-- 9. Backfill: set last_survey_completed_at for users with existing surveys
----------------------------------------------------------------------
UPDATE public.profiles p
SET last_survey_completed_at = sub.max_at
FROM (
  SELECT user_id, MAX(created_at) AS max_at
  FROM public.survey_responses
  GROUP BY user_id
) sub
WHERE p.user_id = sub.user_id
  AND p.last_survey_completed_at IS NULL;
